'use strict';

/**
 * @ngdoc function
 * @name bYoApp.controller:ChatCtrl
 * @description
 * # ChatCtrl
 * Controller of the bYoApp
 */
angular.module('bYoApp')
  .controller('ChatCtrl', function ($scope, socket) {
   //establish peer connection
    var getUserMedia = require('getusermedia');
    getUserMedia( {video:true, audio: true}, function(stream) {
        var Peer = require('simple-peer');
        var peer = new Peer({
        initiator: location.hash === '#init',
        trickle: false,
        stream: stream
        })
    })
    peer.on('error', function (err) { console.log('error', err) })
    //sdp
    peer.on('signal', function(data){
        document.getElementById('yourId').value = JSON.stringify(data);
    })

    //connect both peers to each other
    document.getElementById('connect').addEventListener('click', function() {
        var otherId = JSON.parse(document.getElementById('otherId').value)
        peer.signal(otherId)
    })

    //other message implementation
    //peer.on('data', function(data) {
       // document.getElementById('messages').textContent += data + '\n'
    //})

    //stream video continously
    peer.on('stream', function(stream) {
        var video = document.createElement('video')
        document.body.appendChild(video)
    
        video.src = window.URL.createObjectURL(stream)
        video.play()
    })
  });
