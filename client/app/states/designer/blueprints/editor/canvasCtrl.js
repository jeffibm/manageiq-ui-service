/* eslint angular/controller-as: "off" */

(function() {
  "use strict";

  angular.module('app.states')
    .controller('CanvasController', ['$scope', '$filter', 'DesignerState', '$q', 'CollectionsApi', '$log', StateController]);

  /** @ngInject */
  function StateController($scope, $filter, DesignerState, $q, CollectionsApi, $log) {
    var chartDataModel = {};
    var newNodeCount = 0;
    if ($scope.$parent.blueprint.ui_properties && $scope.$parent.blueprint.ui_properties.chart_data_model) {
      chartDataModel = $scope.$parent.blueprint.ui_properties.chart_data_model;
    }

    // Create the view-model for the chart and attach to the scope.
    $scope.chartViewModel = new flowchart.ChartViewModel(chartDataModel);
    $scope.$parent.chartViewModel = $scope.chartViewModel;

    $scope.$watch("chartViewModel.data", function(oldValue, newValue) {
      if (!angular.equals(oldValue, newValue)) {
        $scope.$emit('BlueprintCanvasChanged', {'chartDataModel': $scope.chartViewModel.data});
      }
    }, true);

    $scope.startCallback = function(event, ui, item) {
      $scope.draggedItem = item;
    };

    $scope.dropCallback = function(event, ui) {
      var newNode = angular.copy($scope.draggedItem);
      if (newNode.type && newNode.type === 'new-generic') {
        newNode.name = 'New ' + newNode.name;
      } else {
        $scope.draggedItem.disableInToolbox = true;
      }
      newNode.backgroundColor = '#fff';
      newNode.x = event.clientX - 350;
      newNode.y = event.clientY - 200;
      $scope.addNewNode(newNode);
      newNodeCount++;
    };

    $scope.addNodeByClick = function(item) {
      var newNode = angular.copy(item);
      if (newNode.type && newNode.type === 'new-generic') {
        newNode.name = 'New ' + newNode.name;
      } else {
        item.disableInToolbox = true;
      }
      newNodeCount++;
      newNode.backgroundColor = '#fff';
      newNode.x = 250 + (newNodeCount * 4 + 160);
      newNode.y = 200 + (newNodeCount * 4 + 160);
      $scope.addNewNode(newNode);
    };

    $scope.addNewNode = function(newNode) {
      if (!newNode.type || newNode.type !== 'new-generic') {
        getTags(newNode.id).then(function(tags) {
          newNode.tags = tags;
          $scope.chartViewModel.addNode(newNode);
        }, function() {
          $scope.chartViewModel.addNode(newNode);
        });
      } else {
        newNode.tags = [];
        $scope.chartViewModel.addNode(newNode);
      }
    };

    function getTags(id) {
      var deferred = $q.defer();

      var attributes = ['categorization', 'category.id', 'category.single_value'];
      var options = {
        expand: 'resources',
        attributes: attributes,
      };

      var collection = 'service_templates' + '/' + id + '/tags';

      CollectionsApi.query(collection, options).then(loadSuccess, loadFailure);

      function loadSuccess(response) {
        var tags = [];
        angular.forEach(response.resources, processTag);

        function processTag(tag) {
          tags.push(getSmTagObj(tag));
        }

        function getSmTagObj(tag) {
          return {id: tag.id,
            category: {id: tag.category.id},
            categorization: {
              display_name: tag.categorization.display_name,
            },
          };
        }

        deferred.resolve(tags);
      }

      function loadFailure() {
        $log.error('There was an error service template tags');
        deferred.reject();
      }

      return deferred.promise;
    }

    $scope.$on('duplicateSelectedItem', function(evt, args) {
      $scope.duplicateSelected();
    });

    $scope.$on('removeSelectedItems', function(evt, args) {
      $scope.deleteSelected();
    });

    $scope.duplicateSelected = function() {
      var dupNode = angular.copy($scope.chartViewModel.getSelectedNodes()[0]);

      if (!dupNode) {
        return;
      }

      dupNode.data.id = getNewId();

      var copyName = getCopyName(dupNode.data.name);

      dupNode.data.name = copyName.name;
      dupNode.data.x = dupNode.data.x + 15 * copyName.numDups;
      dupNode.data.y = dupNode.data.y + 15 * copyName.numDups;

      $scope.addNewNode(dupNode.data);
    };

    $scope.deleteSelected = function() {
      var selectedNodes = $scope.chartViewModel.getSelectedNodes();

      // Re-Enable selectedNodes in toolbox
      for (var i = 0; i < selectedNodes.length; i++) {
        var tabItem = DesignerState.getTabItemById(selectedNodes[i].id());
        if (tabItem) {
          tabItem.disableInToolbox = false;
        }
      }

      $scope.chartViewModel.deleteSelected();
    };

    function getNewId() {
      // random number between 1 and 600
      return Math.floor((Math.random() * 600) + 1);
    }

    function getCopyName(baseName) {
      var baseNameLength = baseName.indexOf(' Copy');

      if (baseNameLength === -1) {
        baseNameLength = baseName.length;
      }

      baseName = baseName.substr(0, baseNameLength);

      var filteredArray = $filter('filter')($scope.chartViewModel.data.nodes, {name: baseName}, false);

      var copyName = baseName + " Copy" + ((filteredArray.length === 1) ? "" : " " + filteredArray.length);
      var numDups = filteredArray.length;

      return {'name': copyName, 'numDups': numDups};
    }

    /*
     *    FlowChart Vars and Methods
     */

    //
    // Code for the delete key.
    //
    var deleteKeyCode = 46;

    //
    // Code for control key.
    //
    var ctrlKeyCode = 17;

    //
    // Set to true when the ctrl key is down.
    //
    var ctrlDown = false;

    //
    // Code for A key.
    //
    var aKeyCode = 65;

    //
    // Code for D key
    //
    var dKeyCode = 68;

    //
    // Code for esc key.
    //
    var escKeyCode = 27;

    //
    // Event handler for key-down on the flowchart.
    //
    $scope.$on('bodyKeyDown', function(evt, args) {
      if (args.origEvent.keyCode === ctrlKeyCode) {
        ctrlDown = true;
        args.origEvent.stopPropagation();
        args.origEvent.preventDefault();
      }

      if (args.origEvent.keyCode === aKeyCode && ctrlDown) {
        //
        // Ctrl + A
        //
        $scope.chartViewModel.selectAll();
        args.origEvent.stopPropagation();
        args.origEvent.preventDefault();
      }

      if (args.origEvent.keyCode === dKeyCode && ctrlDown) {
        //
        // Ctrl + D
        //
        if ($scope.chartViewModel.getSelectedNodes().length === 1) {
          $scope.duplicateSelected();
        }
        args.origEvent.stopPropagation();
        args.origEvent.preventDefault();
      }
    });

    //
    // Event handler for key-up on the flowchart.
    //

    $scope.$on('bodyKeyUp', function(evt, args) {
      if (args.origEvent.keyCode === deleteKeyCode) {
        //
        // Delete key.
        //
        $scope.deleteSelected();
      }

      if (args.origEvent.keyCode === escKeyCode) {
        // Escape.
        $scope.chartViewModel.deselectAll();
      }

      if (args.origEvent.keyCode === ctrlKeyCode) {
        ctrlDown = false;
        args.origEvent.stopPropagation();
        args.origEvent.preventDefault();
      }
    });
  }
})();
