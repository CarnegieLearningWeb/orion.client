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
    'i18n!orion/nls/messages',
    'orion/commands',
    'orion/editor/editor',
    'orion/objects',
    'orion/webui/littlelib',
    'orion/URITemplate',
    'orion/PageUtil',
    'orion/webui/splitter',
    'mixloginstatic/javascript/jquery',
    'globaloria/gide'
], function(messages, mCommands, mEditor, objects, lib, URITemplate, PageUtil, mSplitter, jquery, mGide) {

    var uriTemplate = new URITemplate("#{,resource,params*}");
    var toggleOrientationCommand;
    var previewDiv;

    var Gide = new mGide.Gide;

    var BaseEditor = mEditor.BaseEditor;
    function HTMLEditor(options) {
        this.id = "orion.editor.html";
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
                window.removeEventListener("hashchange", hashChangeListener);
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

        window.addEventListener("hashchange", hashChangeListener);

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

            this._splitter.addEventListener("resize", this._splitterResizeListener);

            var settings = this._editorView.getSettings();

            var currentFile = window.location.hash.slice(1,window.location.hash.length);
        },
        install: function() {
            this._rootDiv = document.createElement("div");
            this._rootDiv.style.position = "absolute";
            this._rootDiv.style.width = "100%";
            this._rootDiv.style.height = "100%";
            this._parent.appendChild(this._rootDiv);

            this._editorDiv = document.createElement("div");
            this._rootDiv.appendChild(this._editorDiv);
            this._editorView.setParent(this._editorDiv);

            this._splitterDiv = document.createElement("div");
            this._splitterDiv.id = "orion.html.editor.splitter";
            this._rootDiv.appendChild(this._splitterDiv);

            this._previewWrapperDiv = document.createElement("div");
            this._previewWrapperDiv.style.overflowX = "hidden";
            this._previewWrapperDiv.style.overflowY = "auto";
            this._rootDiv.appendChild(this._previewWrapperDiv);

            previewDiv = document.createElement("div");
            previewDiv.classList.add("orionHTML");

            this._previewWrapperDiv.appendChild(previewDiv);

            Gide.createIframeWindow(previewDiv);

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
            this._splitter.removeEventListener("resize", this._splitterResizeListener);
            lib.empty(this._parent);
            BaseEditor.prototype.uninstall.call(this);
        }
    });

    function HTMLEditorView(options) {
        this._options = options;

        ID = "html.toggle.orientation";
        toggleOrientationCommand = new mCommands.Command({
            id: ID,
            callback: /* @callback */ function(data) {
                if (this.editor) {
                    this.editor.togglePaneOrientation();
                }
            }.bind(this),
            type: "switch",
            imageClass: "core-sprite-split-pane-orientation",
            tooltip: messages["TogglePaneOrientationTooltip"],
            visibleWhen: function() {
                return !!this._options;
            }.bind(this),
        });
        options.commandRegistry.addCommand(toggleOrientationCommand);
        options.commandRegistry.registerCommandContribution("settingsActions", ID, 1, null, false);
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

    window.toggleWindow = function() {
        // Grab the current iFrame id
        var iframe = $("#previewHTMLFrame")[0];

        if (typeof iframe === 'undefined') {
            var targetNode = document.getElementById('previewHtml');

            // we do not have an iframe, delete the instructional
            // div and build an html frame
            Gide.destroyPreviewInstructionDiv();
            Gide.destroyIframeNavigationWindow();
            Gide.createIframeWindow(targetNode);
        } else {
            // we have a iframe, delete it and add instructional div
            Gide.destroyIframeHTMLWindow();
            Gide.buildIframeInstructionWindow();
        }
    };

    return {
        HTMLEditorView: HTMLEditorView
    };
});
