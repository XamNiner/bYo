'use strict';

/**
 * @ngdoc service
 * @name bYoApp.socket
 * @description
 * # socket
 * Factory in the bYoApp.
 */
angular.module('bYoApp')
  .factory('socket', function () {
    var socket = io.connect()
    return socket;
  });
