var app = angular.module('chatApp', [])


app.factory('socket', function ($rootScope) {
  var socket = io.connect();
  return {
    on: function (eventName, callback) {
      socket.on(eventName, function () {  
        var args = arguments;
        $rootScope.$apply(function () {
          callback.apply(socket, args);
        });
      });
    },
    emit: function (eventName, data, callback) {
      socket.emit(eventName, data, function () {
        var args = arguments;
        $rootScope.$apply(function () {
          if (callback) {
            callback.apply(socket, args);
          }
        });
      })
    }
  };
});

app.controller('ChatCtrl', function($scope, socket) {
    //client side implementation
    $scope.calling = false;
    $scope.count = 0;
    var channelReady = false;
    //ask for username upon connection
    socket.on('connect', function() {
        //prompt user to enter a username
        socket.emit('add:user', prompt("Enter a username!"));
        //established socket connection with server
        channelReady = true; //can send data to other peers
    });
    
    //listen for chat updates from the server
    socket.on('update:chat', function(username, data) {
        $('#conversation').append('<b>'+username+' :</b> ' + data + '<br>');
    });
    
    //listen for room changes
    socket.on('update:rooms', function(rooms, current_room) {
        $('#rooms').empty();
        $.each(rooms, function(key, value) {
            if (value == current_room) {
                $('#rooms').append('<div>'+ value + '</div>');
            } else {
                $('#rooms').append('<div> <a href="#" onclick="switchRoom(\''+value+'\')">' + value + '</a></div>');
            }
        });
    });
    
    //switch to a different room
    function switchRoom(room) {
        socket.emit('switch:room', room);
    }
    
    //active once page is loaded
    $(function() {
        //client clicks send
        $('#datasend').click(function() {
            var message = $('#data').val();
            //clear the text field
            $('#data').val('');
            //emit the message to other clients
            socket.emit('send:msg', message);
        });
        
        //client hits enter
        $('#data').keypress(function(e) {
            if(e.which == 13) {
                $(this).blur();
                $('#datasend').focus().click();
            }
        });
    });
    
    //ui elements 
    var myVideo = document.getElementById('myVideo'),
        theirVideo = document.getElementById('theirVideo'),
        localVidStream = null,
        vidCallButton = document.getElementById('vidCallButton'),
        endCallButton = document.getElementById('endCallButton');
            
    
    //establish a new peer connection
    var peerConn = null,
        //set stun and turn (backup) servers
        peerConnCfg = {'iceServers': 
        [{'url': 'stun:stun.services.mozilla.com'}, {'url': 'stun:stun.l.google.com:19302'}]
        };
    
    //show your own camera stream
    $scope.getCam = function(){
        navigator.getUserMedia({video:true, audio:true}, function(stream) {
        var video = document.getElementById('myVideo');
        video.src = URL.createObjectURL(stream);
        }, function(err) {
            console.log('An error occured: '+err.name);
        }); 
    };
    
    //assign listener to the connection buttons
    
    //vidCallButton.addEventListener('click', initCall());
    //endCallButton.addEventListener('click', endCall());
    
    //call button
    $scope.peer = function() {
        $scope.calling = true;
        initCall();
    }
    
    //call a remote peer
    function initCall(){
        socket.emit('test', '123');
        prepareCall();
        navigator.getUserMedia({audio:true, video:true}, function(stream) {
            localVidStream = stream;
            myVideo.src = URL.createObjectURL(localVidStream);
            peerConn.addStream(localVidStream);
            createAndSendOffer();
        }, function(error){console.log(error);});
    }
    
    //create new connection and add listeners
    function prepareCall() {
        peerConn = new RTCPeerConnection(peerConnCfg);
        peerConn.onicecandidate = onIceCandidateHandler;
        peerConn.onaddstream = onAddStreamHandler;
    }
    
    //handler for new ice candidate
    function onIceCandidateHandler(evt){
        if (!evt || !evt.candidate) {
            //emit new candidate
            socket.emit('new:ice', evt);
        }
    }
    
    //handler for new stream object
    function onAddStreamHandler(evt){
        vidCallButton.setAttribute('disabled', true);
        endCallButton.removeAttribute('disabled');
        theirVideo.src = URL.createObjectURL(evt);
    }
    
    //invite the peer to join the chat
    function createAndSendOffer(){
        peerConn.createOffer(
            function(offer) {
                var off = new RTCSessionDescription(offer);
                peerConn.setLocalDescription(new RTCSessionDescription(off),
                    function(){
                        socket.emit('send:offer', off);
                    }, function(error){console.log(error);}
                );
            }, function(error) {console.log(error)}
        );
    }
    
    //answer another peers offer
    function answerCall(){
        prepareCall();
        //display local stream and send it to the caller
        navigator.getUserMedia({audio:true, video:true}, function(stream) {
            localVidStream = stream;
            myVideo.src = URL.createObjectURL(localVidStream);
            peerConn.addStream(localVidStream);
            createAndSendAnswer();
        }, function(err){ console.log(err)}
        );
    }
    
    function createAndSendAnswer(){
        peerConn.createAnswer(
            function(answer){
               var ans = new RTCSessionDescription(answer);
                peerConn.setLocalDescription(ans, function(){
                    socket.emit('send:answer', ans)
                }, function(error){console.log(error);}
                );
            }, function(error){console.log(error);});
    }
    
    //end a running call with a peer
    function endCall() {
        peerConn.close();
        peerConn = null;
        //reset button attributes
        vidCallButton.removeAttribute('disabled');
        endCall.setAttribute('disabled', true);
        localVidStream.getTracks().forEach(function(track) {
            track.stop();
        });
        //reset the video stream elements
        myVideo.src = '';
        theirVideo.src = '';
    }
    
    //special message from another peer
    socket.on('message', onMessage);
    
    function onMessage(evt) {
        var signal = null;
        //auto answer to call
        if (!peerConn) {
            answerCall();
        }
        signal = JSON.parse(evt.data);
        if (signal.sdp) {
            peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        } else if (signal.candidate) {
            peerConn.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } else if (signal.closeConnection) {
            endCall;
        }
    }  
})
