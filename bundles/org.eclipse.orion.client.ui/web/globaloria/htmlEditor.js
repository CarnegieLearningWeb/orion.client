/*******************************************************************************
 * Copyright (c) 2013 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made
 * available under the terms of the Eclipse Public License v1.0
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html).
 *
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/

/*eslint-env browser, amd*/
/*global URL*/
define([
    'orion/i18nUtil',
    'i18n!orion/nls/messages',
    'orion/commands',
    'orion/editor/editor',
    'orion/fileCommands',
    'orion/objects',
    'orion/webui/littlelib',
    'orion/URITemplate',
    'orion/PageUtil',
    'orion/webui/splitter',
    'orion/URL-shim'
], function(i18nUtil, messages, mCommands, mEditor, mFileCommands, objects, lib, URITemplate, PageUtil, mSplitter) {

    var uriTemplate = new URITemplate("#{,resource,params*}"); //$NON-NLS-0$
    var toggleOrientationCommand;
    var previewDiv;

    var BaseEditor = mEditor.BaseEditor;
    function HTMLEditor(options) {
        this.id = "orion.editor.html"; //$NON-NLS-0$
        this._fileService = options.fileService;
        this._metadata = options.metadata;
        this._parent = options.parent;
        this._model = options.model;
        this._model = '';
        this._editorView = options.editorView;
        this._targetAnchor = options.anchor;

        this._splitterResizeListener = /* @callback */ function(e) {
            this._editorView.editor.resize();
        }.bind(this);

        var hashChangeListener = function(e) {
            var oldParams = PageUtil.matchResourceParameters(e.oldURL);
            var newParams = PageUtil.matchResourceParameters(e.newURL);
            if (oldParams.resource !== newParams.resource || oldParams.editor !== newParams.editor) {
                /* a different editor instance is being opened */
                window.removeEventListener("hashchange", hashChangeListener); //$NON-NLS-0$
                return;
            }

            if (newParams.anchor) {
                this._scrollToAnchor(newParams.anchor);
                /* remove the anchor parameter from the page url */
                window.location.hash = uriTemplate.expand({
                    resource: newParams.resource,
                    params: {editor: newParams.editor}
                });
            }
        }.bind(this);

        window.addEventListener("hashchange", hashChangeListener); //$NON-NLS-0$

        BaseEditor.apply(this, arguments);
    }

    HTMLEditor.prototype = Object.create(BaseEditor.prototype);
    objects.mixin(HTMLEditor.prototype, /** @lends orion.edit.HTMLEditor.prototype */ {
        getPaneOrientation: function() {
            return this._splitter.getOrientation();
        },
        initSourceEditor: function() {
            var editor = this._editorView.editor;
            var textView = editor.getTextView();
            var annotationModel = editor.getAnnotationModel();

            this._splitter.addEventListener("resize", this._splitterResizeListener); //$NON-NLS-0$

            var settings = this._editorView.getSettings();

            var currentFile = window.location.hash.slice(1,window.location.hash.length);
        },
        install: function() {
            this._rootDiv = document.createElement("div"); //$NON-NLS-0$
            this._rootDiv.style.position = "absolute"; //$NON-NLS-0$
            this._rootDiv.style.width = "100%"; //$NON-NLS-0$
            this._rootDiv.style.height = "100%"; //$NON-NLS-0$
            this._parent.appendChild(this._rootDiv);

            this._editorDiv = document.createElement("div"); //$NON-NLS-0$
            this._rootDiv.appendChild(this._editorDiv);
            this._editorView.setParent(this._editorDiv);

            this._splitterDiv = document.createElement("div"); //$NON-NLS-0$
            this._splitterDiv.id = "orion.html.editor.splitter"; //$NON-NLS-0$
            this._rootDiv.appendChild(this._splitterDiv);

            this._previewWrapperDiv = document.createElement("div"); //$NON-NLS-0$
            this._previewWrapperDiv.style.overflowX = "hidden"; //$NON-NLS-0$
            this._previewWrapperDiv.style.overflowY = "auto"; //$NON-NLS-0$
            this._rootDiv.appendChild(this._previewWrapperDiv);

            previewDiv = document.createElement("div"); //$NON-NLS-0$
            previewDiv.classList.add("orionHTML"); //$NON-NLS-0$

            this._previewWrapperDiv.appendChild(previewDiv);

            createIframeWindow(previewDiv);

            this._splitter = new mSplitter.Splitter({
                node: this._splitterDiv,
                sidePanel: this._editorDiv,
                mainPanel: this._previewWrapperDiv,
                toggle: true,
                closeReversely: true
            });
            toggleOrientationCommand.checked = this._splitter.getOrientation() === mSplitter.ORIENTATION_HORIZONTAL;

            BaseEditor.prototype.install.call(this);
        },
        togglePaneOrientation: function() {
            var orientation = this._splitter.getOrientation() === mSplitter.ORIENTATION_VERTICAL ? mSplitter.ORIENTATION_HORIZONTAL : mSplitter.ORIENTATION_VERTICAL;
            this._splitter.setOrientation(orientation);
        },
        uninstall: function() {
            var textView = this._editorView.editor.getTextView();
            this._splitter.removeEventListener("resize", this._splitterResizeListener); //$NON-NLS-0$
            lib.empty(this._parent);
            BaseEditor.prototype.uninstall.call(this);
        }
    });

    function HTMLEditorView(options) {
        this._options = options;

        ID = "html.toggle.orientation"; //$NON-NLS-0$
        toggleOrientationCommand = new mCommands.Command({
            id: ID,
            callback: /* @callback */ function(data) {
                if (this.editor) {
                    this.editor.togglePaneOrientation();
                }
            }.bind(this),
            type: "switch", //$NON-NLS-0$
            imageClass: "core-sprite-split-pane-orientation", //$NON-NLS-0$
            tooltip: messages["TogglePaneOrientationTooltip"],
            visibleWhen: function() {
                return !!this._options;
            }.bind(this),
        });
        options.commandRegistry.addCommand(toggleOrientationCommand);
        options.commandRegistry.registerCommandContribution("settingsActions", ID, 1, null, false); //$NON-NLS-0$
    }
    HTMLEditorView.prototype = {
        create: function() {
            this.editor = new HTMLEditor(this._options);
            this.editor.install();
            this._options.editorView.create();
            this.editor.initSourceEditor();
        },
        destroy: function() {
            this.editor.destroy();
            this.editor = null;
            this._options.editorView.destroy();
            this._options.editorView = null;

            this._options = null;
        }
    };

    function createIframeWindow(targetNode) {
        // Add the current page iframe to the current page
        var frameDiv          = document.createElement("div");
        frameDiv.id           = 'previewHtml'; //$NON-NLS-0$

        var iframe            = document.createElement("iframe"); //$NON-NLS-0$
        iframe.id             = 'previewFrame'; //$NON-NLS-0$
        iframe.name           = 'HTML Previewer'; //$NON-NLS-0$
        iframe.type           = "text/html"; //$NON-NLS-0$
        iframe.sandbox        = "allow-scripts allow-same-origin allow-forms"; //$NON-NLS-0$
        frameDiv.style.border = "none"; //$NON-NLS-0$
        frameDiv.style.width  = "100%"; //$NON-NLS-0$
        frameDiv.style.height = "100%"; //$NON-NLS-0$
        iframe.style.width    = "100%"; //$NON-NLS-0$
        iframe.style.height   = "100%"; //$NON-NLS-0$

        var currentFile = window.location.hash.slice(1,window.location.hash.length);
        //TODO not sure why the edit view adds an extra 25 to the %20 space character, but this adjusts for that
        currentFile  = currentFile.replace(new RegExp('25', 'g'),'');
        currentFile  = currentFile.replace(',editor=orion.editor.html','');
        var port     = ":"+window.location.port;
        var protocol = window.location.protocol+"//";
        var fullUrl;

        if(window.location.port!=='')
            fullUrl = protocol+window.location.hostname+port+currentFile;
        else
            fullUrl = protocol+window.location.hostname+currentFile;

        iframe.src = fullUrl;

        // Add a refresh button to reload the game
        var reloadButton         = document.createElement("button");
        reloadButton.textContent = 'Refresh Preview';
        reloadButton.className   = 'btn glife-green';
        reloadButton.setAttribute('onClick', 'document.getElementById("previewFrame").contentWindow.location.reload()');

        // Add a refresh button to reload the game
        var newWindowButton         = document.createElement("a");
        newWindowButton.textContent = 'Open in New Page';
        newWindowButton.className   = 'btn glife-navy';
        newWindowButton.setAttribute('href', fullUrl);
        newWindowButton.setAttribute('target', '_blank');

        frameDiv.appendChild(reloadButton);
        frameDiv.appendChild(newWindowButton);
        frameDiv.appendChild(iframe);
        targetNode.appendChild(frameDiv);       
    }

    return {
        HTMLEditorView: HTMLEditorView
    };
});