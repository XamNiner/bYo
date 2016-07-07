(function() {
    'use strict';
    
    angular.module('chatApp')
    .directive('chatBox', function() {
        return {
            restrict: 'E',
            template: '<textarea style="width: 100%; 200px" ng-disable="true" ng-model="msgs"></textarea>',
            controller: function($scope, $element) {
                $scope.watch('msgs', function() {
                    var textArea = $element[0].children[0];
                    textArea.scrollTop = textArea.scrollHeight;
                });
            }
        };
    });
}());