var app = angular.module('chatApp', [])


app.factory('socket', function() {
    var socket = io.connect('http://localhost:3000');
    return socket;
})

app.controller('ChatCtrl', function($scope, socket) {

    
})
