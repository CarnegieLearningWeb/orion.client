/*******************************************************************************
 * @license
 * Copyright (c) 2009, 2014 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
 
/*eslint-env browser, amd*/

define(['i18n!profile/nls/messages', 'orion/i18nUtil', 'require', 'orion/webui/littlelib', 'orion/explorers/explorer', 'orion/profile/usersUtil', 'orion/explorers/navigationUtils', 'orion/xhr', 'orion/Deferred'], 
        function(messages, i18nUtil, require, lib, mExplorer, mUsersUtil, mNavUtils, mXhr, Deferred) {


var eclipse = eclipse || {};

eclipse.StudentsList = (function(){
    
    function StudentsList(serviceRegistry, commandService, selection, searcher, parentId, toolbarId, pageNavId, selectionToolsId, actionScopeId) {
        this.registry = serviceRegistry;
        this.commandService = commandService;
        this.selection = selection;
        this.searcher = searcher;
        this.parentId = parentId;
        this.toolbarId = toolbarId;
        this.pageNavId = pageNavId;
        this.selectionToolsId = selectionToolsId;
        this.actionScopeId = actionScopeId;
        this.model = null;
        this.myTree = null;
        this.renderer = new eclipse.UsersRenderer({actionScopeId: this.actionScopeId, commandService: this.commandService, checkbox: false, cachePrefix: "UsersNavigator"}, this); //$NON-NLS-0$
        this.studentsList = null;
    }
    
    StudentsList.prototype = new mExplorer.Explorer();
    
    StudentsList.prototype.queryObject = { start: 0, rows:100, length: 0};
    
    StudentsList.prototype.calculateQuery = function(locationHash, queryObj) {
        var startQuery = locationHash.indexOf("?"); //$NON-NLS-0$
        if (startQuery !== -1) {
            var queryStr = locationHash.substring(startQuery + 1);
            var splitQ = queryStr.split("&"); //$NON-NLS-0$
            for(var i=0; i < splitQ.length; i++){
                var splitparameters = splitQ[i].split("="); //$NON-NLS-0$
                if(splitparameters.length === 2){
                    if(splitparameters[0] === "rows"){  //$NON-NLS-0$
                        queryObj.rows = parseInt(splitparameters[1], 10);
                    } else if(splitparameters[0] === "start"){ //$NON-NLS-0$
                        queryObj.start = parseInt(splitparameters[1], 10);
                    }
                }
            }
        }
    };

    StudentsList.prototype.loadUsers = function() {
        var parent = lib.node(this.parentId);
        var queryObj = StudentsList.prototype.queryObject;

        // Progress indicator
        var progress = lib.node("progress");
        if(!progress){
            progress = document.createElement("div");
            lib.empty(parent);
            progress.id = "progress";
            parent.appendChild(progress);
        }
        lib.empty(progress);
        progress.appendChild(document.createTextNode(messages["Loading users..."]));
        
        var service = this.registry.getService("orion.core.user");
        StudentsList.prototype.registry = this.registry;
        
        var locationHash = window.location.hash;
        StudentsList.prototype.calculateQuery(locationHash, queryObj);


        // Keep track of current context
        var _this = this;
        var users = getStudentList.bind(this);
        users(function(students) {
            _this.studentsList    = students;
            var flatModel         = new mExplorer.ExplorerFlatModel("../users", StudentsList.prototype.getUsersListSubset.bind(_this));
            flatModel.service     = service;
            flatModel.queryObject = queryObj;
            _this.queryObject = queryObj;
            _this.createTree(_this.parentId, flatModel, {setFocus: true});
            mUsersUtil.updateNavTools(_this.registry, _this.commandService, _this, _this.toolbarId, _this.pageNavId, _this.selectionToolsId, {});
        });
    };

    StudentsList.prototype.getUsersListSubset = function(root) {
        var aService;
        if (this.service) {
            aService = this.service;
        } else {
            aService = this.registry.getService("orion.core.user"); //$NON-NLS-0$
        }

        return aService.getStudentList(this.studentsList).then(
            function(result) {
                this.queryObject.start = parseInt(result.UsersStart, 10);
                this.queryObject.rows = parseInt(result.UsersRows, 10);
                this.queryObject.length = parseInt(result.UsersLength, 10);

                return result.Users;
            }.bind(this),function(error) {
                var display = {};
                display.Severity = "Error"; //$NON-NLS-0$
                display.HTML = false;
                display.Message = messages["Permission to view user list denied."]; //$NON-NLS-0$
                this.registry.getService("orion.page.message").setProgressResult(display); //$NON-NLS-0$
                var progress = lib.node("progress");  //$NON-NLS-0$
                lib.empty(progress);
            }.bind(this));
    };

    var getStudentList = function(callback) {
        this.userService      = this.registry.getService("orion.core.user");
        var authenticationIds = [];
        var authServices      = this.registry.getServiceReferences("orion.core.auth");
        var userService       = this.userService;
        var studentList       = [];
        var promisesArray     = [];

        // Grab the current User in the loggedin session
        for (var i = 0; i < authServices.length; i++) {
            var servicePtr  = authServices[i];
            var authService = this.registry.getService(servicePtr); 
            var deferred    = new Deferred();

            var authService    = this.registry.getService(servicePtr);
            var passwordFields = this.passwordFields;

            authService.getKey().then(function(key){
                authenticationIds.push(key);

                authService.getUser().then(function(jsonData){
                    var basePath       = '/profile/users/';
                    var authUserName   = jsonData.UserName;
                    var usrLocation    = jsonData.Location;
                    var targetFileName = 'students-list.json';
                    var studentListUrl = basePath + authUserName + '/' + targetFileName;

                    // Find that user's student-list if it exists
                    mXhr('GET', studentListUrl).then(function(data) {
                        students   = data.response;
                        students   = JSON.parse(students);
                        studentLen = students.length;

                        // loop thru the student list and grab each one of those user's user.json details
                        for (var key in students) {
                            var count = 0;
                            var studentName = students[key];
                            var location    = '/users/' + studentName;

                            userService.getUserInfo(location).then(function(accountData) {
                                count = count + 1;
                                // build an onject that ressembles the result.Users you see below
                                studentList.push(accountData);
                                
                                // If this is the end of the processing
                                if (count == studentLen) {
                                    deferred.resolve(studentList);
                                }
                            });
                        }
                    });
                });
            });
        }

        deferred.then(function(data) {
            // Using callback because we need to send data to an async function from a sycn function
            callback(studentList);
        });
    }

    return StudentsList;
}());


eclipse.UsersRenderer = (function() {
    function UsersRenderer (options, explorer) {
        this._init(options);
        this.explorer = explorer;
    }
    UsersRenderer.prototype = new mExplorer.SelectionRenderer();
    
    UsersRenderer.prototype.getCellHeaderElement = function(col_no){
        var col = document.createElement("th"); //$NON-NLS-0$
        var h2 = document.createElement("h2"); //$NON-NLS-0$
        col.appendChild(h2);
        switch(col_no){
        case 0: 
            h2.textContent = messages["User Name"];
            return col;
        case 1:
            h2.textContent = messages["Full Name"];
            return col;
        case 2:
            h2.textContent = messages["Last Login"];
            return col;
        case 3:
            h2.textContent = messages["Disk Usage"];
            return col;
        case 4:
            h2.textContent = messages["Home Wiki"];
            return col;
        }
    };
    
    UsersRenderer.prototype.getCellElement = function(col_no, item, tableRow){
        var td;
        switch(col_no){
        case 0: 
            var col, div, link;
            col = document.createElement('td'); //$NON-NLS-0$
            div = document.createElement('div'); //$NON-NLS-0$
            div.style.padding = "5px;"; //$NON-NLS-0$
            col.appendChild(div);
            link = document.createElement('a'); //$NON-NLS-0$
            link.className = "navlinkonpage"; //$NON-NLS-0$
            link.href = require.toUrl("edit/edit.html") + "#/file/" + item.UserName + "-OrionContent"; //$NON-NLS-1$ //$NON-NLS-0$
            div.appendChild(link);
            link.appendChild(document.createTextNode(item.UserName));
            mNavUtils.addNavGrid(this.explorer.getNavDict(), item, link);
            return col;
        case 1:
            td = document.createElement("td"); //$NON-NLS-0$
            td.textContent = item.FullName ? item.FullName : " "; //$NON-NLS-0$
            return td;
        case 2:
            td = document.createElement("td"); //$NON-NLS-0$
            td.textContent = item.LastLoginTimestamp ? new Date(parseInt(item.LastLoginTimestamp, 10)).toLocaleString() : '\u00a0'; //$NON-NLS-0$
            return td;
        case 3:
            td = document.createElement("td"); //$NON-NLS-0$
            var diskUsage = item.DiskUsage ? item.DiskUsage : " "; //$NON-NLS-0$
            var diskUsageTextContent = '\u00a0'; //$NON-NLS-0$
            if (diskUsage !== " ") {
                var diskUsageTimestamp = item.DiskUsageTimestamp ? new Date(parseInt(item.DiskUsageTimestamp, 10)).toLocaleString() : '\u00a0'; //$NON-NLS-0$
                diskUsageTextContent = i18nUtil.formatMessage(messages["A(lastCalculated B)"], diskUsage, diskUsageTimestamp); //$NON-NLS-1$ //$NON-NLS-0$
            };
            td.textContent = diskUsageTextContent;
            return td;
        case 4:
            td = document.createElement("td"); //$NON-NLS-0$
            td.textContent = item.HomeWiki ? item.HomeWiki : " "; //$NON-NLS-0$
            return td;
        }
        
    };
    
    return UsersRenderer;
}());

return eclipse; 
});