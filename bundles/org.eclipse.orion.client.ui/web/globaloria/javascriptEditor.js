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
    function JavaScriptEditor(options) {
        this.id = "orion.editor.js"; //$NON-NLS-0$
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

    JavaScriptEditor.prototype = Object.create(BaseEditor.prototype);
    objects.mixin(JavaScriptEditor.prototype, /** @lends orion.edit.JavaScriptEditor.prototype */ {
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
            this._splitterDiv.id = "orion.js.editor.splitter"; //$NON-NLS-0$
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
        },
        destroy: function() {
            this.editor.destroy();
            this.editor = null;
            this._options.editorView.destroy();
            this._options.editorView = null;

            this._options = null;
        }
    };

    // Mapping for the lessons/ topics with URL
    var lessonTopicMapping = {
        "02_drawShape.js"            : "JS1:Build_Basic_Game_-_Draw_Shape",
        "03_moveShape.js"            : "JS1:Build_Basic_Game_-_Move_Shape",
        "04_controlShape.js"         : "JS1:Build_Basic_Game_-_Control_Shape",
        "05_displayScore.js"         : "JS1:Build_Basic_Game_-_Display_Score",
        "06_increaseScore.js"        : "JS1:Build_Basic_Game_-_Increase_Score",
        "07_multipleCollectables.js" : "JS1:Build_Basic_Game_-_Multiple_Collectables",
        "08_multipleEnemies.js"      : "JS1:Build_Basic_Game_-_Multiple_Enemies",
        "09_addArtwork.js"           : "JS1:Customize_Action_Game_-_Add_Artwork",
        "10_addSounds.js"            : "JS1:Customize_Action_Game_-_Add_Sounds",
        "11_addGameOver.js"          : "JS1:Customize_Action_Game_-_Add_Game_Over_Screen",
        "12_extendScene.js"          : "JS1:Customize_Action_Game_-_Extend_Scene",
        "13_addGoal.js"              : "JS1:Customize_Action_Game_-_Add_Goal_and_Victory_Screen"
    };

    var grabCurrentLessonFromURL = function(hash) {
        hash = hash.replace(',editor=orion.editor.js','');
        hash = hash.split('/');
        var fileName = hash[hash.length - 1];
        
        return fileName;
    }

    function createIframeWindow(targetNode) {
        var windowHash        = window.location.hash;
        var lessonName        = grabCurrentLessonFromURL(windowHash);
        // Add the current page iframe to the current page
        var frameDiv          = document.createElement("div");
        frameDiv.id           = 'previewHtml';

        // Only create help and topic links if this file contains a link to map to
        if(lessonTopicMapping.hasOwnProperty(lessonName)) {
            var topicBaseURL      = "https://myglife.org/mwiki/index.php/"
            var topicFullURL      = topicBaseURL + lessonTopicMapping[lessonName];
            var iframe            = document.createElement("iframe");
            iframe.id             = 'previewFrame';
            iframe.name           = 'HTML Previewer';
            iframe.type           = "text/html";
            iframe.sandbox        = "allow-scripts allow-same-origin allow-forms";
            frameDiv.style.border = "none";
            frameDiv.style.width  = "100%";
            frameDiv.style.height = "100%";
            iframe.style.width    = "100%";
            iframe.style.height   = "99%";

            iframe.src        = topicFullURL;
            var el            = document.querySelector('.orionHTML');
            var match         = el.querySelectorAll('iframe');
            // Create new 'sticky' div for help and view topic buttons
            var helpDiv       = document.createElement('div');
            helpDiv.id        = 'helpDiv';
            helpDiv.className = 'help-div';

            // Add a refresh button to reload the game
            var getHelpButton         = document.createElement("a");
            getHelpButton.textContent = 'Get Help?';
            getHelpButton.className   = 'btn glife-navy';

            getHelpButton.setAttribute('href', 'https://globaloriahelp.zendesk.com');
            getHelpButton.setAttribute('target', '_blank');

            // Add a refresh button to reload the game
            var viewTopicButton         = document.createElement("a");
            viewTopicButton.textContent = 'View Full Topic';
            viewTopicButton.className   = 'btn glife-navy';

            viewTopicButton.setAttribute('href', topicFullURL);
            viewTopicButton.setAttribute('target', '_blank');

            helpDiv.appendChild(viewTopicButton);
            helpDiv.appendChild(getHelpButton);
            targetNode.appendChild(helpDiv);
            frameDiv.appendChild(iframe);
        } else {
            var notFoundH1             = document.createElement('h1');
            notFoundH1.style.color     = '#ffffff';
            notFoundH1.style.textAlign = 'center';
            notFoundH1.innerHTML       = 'There was an error with the file you are trying to preview';

            var notFoundGif   = document.createElement('img');
            notFoundGif.src   = '../www404noHeader2.gif';
            notFoundGif.style.display = 'block';
            notFoundGif.style.marginLeft = 'auto';
            notFoundGif.style.marginRight = 'auto';
            notFoundGif.alt   = 'Sorry! Lesson not found';
            document.querySelector('.orionHTML').style.backgroundColor = '#004A80';

            var notFoundDiv = document.createElement('div');
            notFoundDiv.className = 'not-found-div';

            notFoundDiv.appendChild(notFoundH1);
            notFoundDiv.appendChild(notFoundGif);
            frameDiv.appendChild(notFoundDiv);
        }

        targetNode.appendChild(frameDiv);
    }

    return {
        JavaScriptEditorView: JavaScriptEditorView
    };
});