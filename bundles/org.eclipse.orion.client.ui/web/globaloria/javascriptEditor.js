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

    var uriTemplate = new URITemplate("#{,resource,params*}"); //$NON-NLS-0$
    var toggleOrientationCommand;
    var previewDiv;

    var Gide = new mGide.Gide;

    var BaseEditor = mEditor.BaseEditor;
    function JavaScriptEditor(options) {
        this.id = "orion.editor.js"; //$NON-NLS-0$
        this._fileService = options.fileService;
        this._metadata = options.metadata;
        this._parent = options.parent;
        this._model = options.model;
        this._model = '';
        this._editorView = options.editorView;
        this._targetAnchor = options.anchor;

//        this._splitterResizeListener = /* @callback */ function(e) {
//            this._editorView.editor.resize();
//        }.bind(this);

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

    JavaScriptEditor.prototype = Object.create(BaseEditor.prototype);
    objects.mixin(JavaScriptEditor.prototype, /** @lends orion.edit.JavaScriptEditor.prototype */ {
        getPaneOrientation: function() {
            return this._splitter.getOrientation();
        },
        initSourceEditor: function() {
            var editor = this._editorView.editor;
            var textView = editor.getTextView();
            var annotationModel = editor.getAnnotationModel();

//            this._splitter.addEventListener("resize", this._splitterResizeListener); //$NON-NLS-0$

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
            this._editorDiv.style.width = "100%"; //$NON-NLS-0$
            this._editorDiv.style.height = "100%"; //$NON-NLS-0$
            this._rootDiv.appendChild(this._editorDiv);
            this._editorView.setParent(this._editorDiv);

//            this._splitterDiv = document.createElement("div"); //$NON-NLS-0$
//            this._splitterDiv.id = "orion.js.editor.splitter"; //$NON-NLS-0$
//            this._rootDiv.appendChild(this._splitterDiv);

            this._previewWrapperDiv = document.createElement("div"); //$NON-NLS-0$
            this._previewWrapperDiv.style.overflowX = "hidden"; //$NON-NLS-0$
            this._previewWrapperDiv.style.overflowY = "auto"; //$NON-NLS-0$
//            this._rootDiv.appendChild(this._previewWrapperDiv);

            previewDiv = document.createElement("div"); //$NON-NLS-0$
            previewDiv.classList.add("orionHTML"); //$NON-NLS-0$

//            this._previewWrapperDiv.appendChild(previewDiv);

//            Gide.createIframeWindow(previewDiv);

//            this._splitter = new mSplitter.Splitter({
//                node: this._splitterDiv,
//                sidePanel: this._editorDiv,
//                mainPanel: this._previewWrapperDiv,
//                toggle: true,
//                closeReversely: true
//            });
//            toggleOrientationCommand.checked = this._splitter.getOrientation() === mSplitter.ORIENTATION_HORIZONTAL;

            BaseEditor.prototype.install.call(this);
        },
        togglePaneOrientation: function() {
//            var orientation = this._splitter.getOrientation() === mSplitter.ORIENTATION_VERTICAL ? mSplitter.ORIENTATION_HORIZONTAL : mSplitter.ORIENTATION_VERTICAL;
//            this._splitter.setOrientation(orientation);
        },
        uninstall: function() {
            var textView = this._editorView.editor.getTextView();
//            this._splitter.removeEventListener("resize", this._splitterResizeListener); //$NON-NLS-0$
            lib.empty(this._parent);
            BaseEditor.prototype.uninstall.call(this);
        }
    });

    function JavaScriptEditorView(options) {
        this._options = options;

        ID = "js.toggle.orientation"; //$NON-NLS-0$
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
    JavaScriptEditorView.prototype = {
        create: function() {
            this.editor = new JavaScriptEditor(this._options);
            this.editor.install();
            this._options.editorView.create();
            this.editor.initSourceEditor();

            Gide.destroyIframeNavigationWindow();
            Gide.destroyIframeHTMLWindow();
//            Gide.buildIframeInstructionWindow();
        },
        destroy: function() {
            this.editor.destroy();
            this.editor = null;
            this._options.editorView.destroy();
            this._options.editorView = null;

            this._options = null;
            Gide.destroyPreviewInstructionDiv();
        }
    };

    return {
        JavaScriptEditorView: JavaScriptEditorView
    };
});