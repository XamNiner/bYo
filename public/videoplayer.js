'use strict';

angular.module('chatApp')
    .directive('videoPlayer', function($sce){
    return {
        template: '<div><video ng-src="" autoplay></video></div>',
        restrict: 'E',
        replace: true,
        scope: {
            vidSrc: '@'
        },
        link: function(scope) {
            console.log('Init player');
            scope.trustSrc = function() {
                if(!scope.vidSrc) {
                    return undefined;
                }
                return $sce.trustAsResourceUrl(scope.vidSrc);
            };
        }
    };
});