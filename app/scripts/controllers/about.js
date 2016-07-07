'use strict';

/**
 * @ngdoc function
 * @name bYoApp.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the bYoApp
 */
angular.module('bYoApp')
  .controller('AboutCtrl', function ($scope) {
    $scope.inCall = false;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    
    //new peer instance
    var peer = new Peer({ 
        key: 'l01oz2g2gbxx0f6r', 
        debug: 3, 
        config: {'iceServers': [
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'stun:stun1.l.google.com:19302' },
        ]}
    });
    
    //get peer Id
    peer.on('open', function(){
      $('#myId').text(peer.id);
    });
    
    //peer is called by a remote peer
    peer.on('call', function(incomingCall){
       window.currentCall = incomingCall;
        $scope.inCall = true;
        incomingCall.answer(window.localStream);
        incomingCall.on('stream', function(remoteStream){
            //stream remote peer camera output
            window.remoteStream = remoteStream;
        
            //new video object
            var video = document.getElementById("theirVideo");
            video.src = URL.createObjectURL(remoteStream);  
        });
    });
    
    navigator.getUserMedia({audio:true, video: true}, function (stream) {
      //display video
      var video = document.getElementById("myVideo");
      video.src = URL.createObjectURL(stream);
      window.localStream = stream;
    }, function (error) { console.log(error); }
    );
    
    //handle click events
    $(function() {
        $('#makeCall').click(function() {
            var outgoingCall = peer.call($('#remotePeerId').val(), window.localStream);
            window.currentCall = outgoingCall;
            outgoingCall.on('stream', function(remoteStream) {
                window.remoteStream = remoteStream;
                var video = document.getElementById("theirVideo");
                video.src = URL.createObjectURL(remoteStream);
            });
        });
        
        $('#endCall').click(function() {
            if ($scope.inCall){
                window.currentCall.close(); 
                $scope.inCall = false;
            }
        });
    })
});
