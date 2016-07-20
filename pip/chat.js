'use strict';

angular.module('chatApp')
.controller('chatCtrl', function($scope, socket) {
    //client side implementation
    $scope.userNames = [];      //list of usernames
    var channelReady = false;   //check if localStream is available before calling
    var praxis = 'pr23';        //praxis number to create a peer id
    
    $scope.name = null;         //own name
    
    //show warning if no user media found or camera access granted
    $scope.noMedia = false;
    $scope.noCamera = false;
    //client states
    $scope.gumedia = true;
    $scope.inCall = false;
    
    var localVideo = document.getElementById('localVideo'),
        remoteVideo = document.getElementById('remoteVideo');
    
    //send peer connection request to this id
    $scope.peerId;  //id of the object to be called
    $scope.ownId;   //set last id numbers yourself 
    $scope.setId = 42; //standard
    $scope.accepted = false; //has client answered a peer request?
    
    //Id of the other peer
    $scope.partnerId;
    var isChannelReady = false, //is client able to stream media?
        isInitiator = false,    //has client initiated the call?
        isStarted = false;      //is media being streamed to another peer?
    
    var pc,             //p2p connection 
        localStream,    //your own media stream
        remoteStream;   //media stream of the second peer

    var pcConfig = {
      'iceServers': [{
        'url': 'stun:stun.l.google.com:19302'
      }]
    };

    // Set up audio and video regardless of what devices are present.
    var sdpConstraints = {
      'mandatory': {
        'OfferToReceiveAudio': true,
        'OfferToReceiveVideo': true
      } 
    };
    
    //-----------------------------------------------------------------
    //Socket io event handling
    //-----------------------------------------------------------------
    
    //check if getUserMedia is available
    if (navigator.mediaDevices === undefined) {
            $scope.noMedia = true;
    }
    
    //ask for username upon connection
    socket.on('connect', function() {
        //prompt user to enter a username
       $scope.name = prompt('Enter a username!');
        socket.emit('add:user', $scope.name);
    });
    
    //listen for chat updates from the server
    socket.on('update:chat', function(username, data) {
        $('#conversation').append('<b>'+username+' :</b> ' + data + '<br>');
    });
    
    //listen for user changes
    socket.on('update:user', function(uData) {
        $scope.userNames = uData;
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
    
    //show Ids of all connected peers(+ own)
    socket.on('get:pid', function(peerIds) {
        console.log('updating the peer ids');
        $scope.pids = peerIds; 
    });
    
    // This client receives a message
    socket.on('message', function(message) {
        console.log('Client received message:', message);
        if (message.type === 'candidate' && isStarted) {
            var candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
            });
            pc.addIceCandidate(candidate);
        } else if (message === 'bye' && isStarted) {
            handleRemoteHangup();
        }
    });
    
    //deal with private messages
    socket.on('get:pvtmsg', function(data) {
        //handle private message exchange between peers
        if (data.receiver === $scope.setId) {
            console.log('Got the right client');
            if (data.message === 'request') {
                console.log('>>>>>>>>>>>request start');
                startRequest(data);  
            } else if (data.message === 'answered') {
                //accepted the call request
                answeredRequest(data);
            } else if (data.message === 'denied') {
                console.log('<<<<<<<<<<<request end')
                console.log('Client with id - '+data.sender+' refused the connection.');
                //display refusal
                window.alert('Client refused your connection! Please try again.');
            } else if (data.message === 'in:call') {
                console.log('<<<<<<<<<<<request end');
                console.log('Requested client is in another call!');
                //display warning
                window.alert('The requested Client is currently in another call. Please try again later.');
            } else if (data.message === 'not:ready') {
                console.log('<<<<<<<<<<<request end');
                console.log('The requested client is not ready to establish a p2p connection.');
                //display warning
                window.alert('The requested client is not yet ready to establish a connection. Please try again later.');
            } else {
                console.log('Received remote message!');
            } 
        }
    });
    
    //rtc handshake
    socket.on('rtc:msg', function(data) {
        //check if correct client
        if (data.receiver === $scope.setId) {
            $scope.partnerId = data.sender;
            if (data.message === 'offer') {
                console.log('Received a new offer from a peer');
                if (!isInitiator && !isStarted) {
                    prepareAnswer();
                }
                pc.setRemoteDescription(new RTCSessionDescription(data.session));
                answerPeer();
            } else if (data.session.type === 'answer' && isStarted) {
                console.log('Receiving sdp answer');
                pc.setRemoteDescription(new RTCSessionDescription(data.session));
                console.log('Established connection with peer.');
            }
        }
    });

    //logging the server messages
    socket.on('log', function(array) {
        console.log.apply(console, array);
    });
    
    //-----------------------------------------------------------------
    //send text messages to clients in the same room
    //-----------------------------------------------------------------
    
    //switch to a different room
    function switchRoom(room) {
        socket.emit('switch:room', room);
    }
    
    //active once page is loaded
    $(function() {
        //sending text messages between clients in the same room
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
    
    //-----------------------------------------------------------------
    //sending messages to all clients
    //-----------------------------------------------------------------
    
    //send connection messages
    function sendMessage(message) {
        console.log('Client sending message: ', message);
        socket.emit('message', message);
    }
    
    //init a new peer connection upon receiving an sdp offer
    function beginAnswering() {
        console.log('Channel is ready: '+ isChannelReady);
        //receiveLocalVideo();
        console.log('Started: '+isStarted+' LocalStream: '+ localStream +' Channel Ready? '+ isChannelReady);
        if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
            console.log('ENTERED!!!')
            //change button access - able to hang up on the caller
            $scope.gumedia = true;
            $scope.inCall = true;
        
            //create new RTCPeerConnection
        
            createPeerConnection();
            pc.addStream(localStream);
            isStarted = true;
        }
    }
    //-----------------------------------------------------------------
    //init new local video stream
    //-----------------------------------------------------------------
    
    //function for button click
    $scope.getLocalVideo = function(){
        receiveLocalVideo();
    }

    function receiveLocalVideo() {
        if (navigator.mediaDevices.getUserMedia !== 'undefined') {
            //get the video stream
            $scope.gumedia = false;
            console.log('getUserMedia active');
            navigator.mediaDevices.getUserMedia({audio: true, video: true})
            .then(createStream)
            .catch(function(e) {
                $scope.noCamera = true;
                alert('getUserMedia error: ' + e.name);
            });
            console.log('AFTER STREAM');
        } else {
            $scope.noMedia = true;
            console.log('getUserMedia is not supported in this browser!');
        }
    }
    
    function createStream(stream){
        console.log('Adding local stream');
        localVideo.src = window.URL.createObjectURL(stream);
        localStream = stream;
        console.log('The local stream has been initialized: '+localStream);
        sendMessage('got user media');
        //got local stream --> can begin calling other peers
        isChannelReady = true;
    }
    
    
    //-----------------------------------------------------------------
    //request a new peer connection
    //-----------------------------------------------------------------
    
    //add your own id suffix
    $scope.makeId = function() {
        //create an id from praxis number, username and suffix
        //complete version
        $scope.setId = praxis+''+$scope.name+''+$scope.ownId;
        console.log('Setting own id from '+$scope.setId+' to '+$scope.ownId);
        //send complete peer id to all clients
        socket.emit('update:pid', $scope.setId);
    }
    
    //request a peer connection from another client
    $scope.sendRequest = function() {
        console.log('sending request to establish peer connection');
        var message = 'request';
        console.log('Check - '+$scope.setId+' - '+$scope.peerId);
        var a = $scope.setId,
            b = $scope.peerId,
            data = {
                sender: a,
                receiver: b,
                message: message
            };
        sendPrivateMessage(data);
        console.log('Value in peerId '+$scope.peerId);
    }
    
    function startRequest(data) {
        if (isChannelReady && !$scope.inCall) {
            var p = window.confirm("Peer Id: "+data.sender+" requests a peer connection. Accept?");
            if (p == true) {
                //accepted
                console.log('Accepted the other clients request!');
                //accepting the peers call
                var answer = {
                    sender: data.receiver,
                    receiver: data.sender,
                    message: 'answered'
                };
                //send answer to caller
                sendPrivateMessage(answer);
            } else {
                //refused connection
                console.log('Denied the other clients request!');
                //send refusal back to sender
                var denied = {
                    sender: data.receiver,
                    receiver: data.sender,
                    message: 'denied'
                };
                sendPrivateMessage(denied);
            }    
        } else if (isChannelReady && $scope.inCall){
            console.log('Another peer called while in p2p call Id: '+data.sender);
            var inCall = {
                sender: data.receiver,
                receiver: data.sender,
                message: 'in:call'
            };
            sendPrivateMessage(inCall);
        } else {
            console.log('Not ready while being called by peer Id: '+data.sender);
            var notReady = {
                sender: data.receiver,
                receiver: data.sender,
                message: 'not:ready'
            }
            sendPrivateMessage(notReady);
        }  
    }
    
    //emitting private message to another peer
    function sendPrivateMessage(data) {
        console.log('Sender id: '+data.sender+' and Receiver id: '+data.receiver);
        console.log('Sending private message: '+ data.message);
        socket.emit('private:msg', data);
    }
    
    //-----------------------------------------------------------------
    //begin to establish peer connection
    //-----------------------------------------------------------------
    function answeredRequest(data) {
        console.log('Client with id - '+data.sender+' answered your call.');
                
        //other peer accepted the request - init new peer connection
        //initiator begin sdp offer
        var offering = {
            sender: data.receiver,
            receiver: data.sender,
            message: 'sdp:offer'
        }
        callPeer(offering);
    }
    
    function callPeer(data) {
        console.log('Begin of new Peer Connection');
        if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
            //change button access
            $scope.gumedia = true;
            $scope.inCall = true;
            
            //new connection
            createPeerConnection();
            pc.addStream(localStream);
            isStarted = true;
            isInitiator = true;
            
            //create the offer
            //doCall();
            startOffer(data);
        }
    }
    
    function createPeerConnection(){
        try {
            console.log('>>>>>> creating peer connection');
            pc = new RTCPeerConnection(null);
            
            //add event handler
            pc.onicecandidate = handleIceCandidate;
            pc.onaddstream = handleRemoteStreamAdded;
            pc.onremovestream = handleRemoteStreamRemove;
        }catch (e) {
            console.log('Failed to create PeerConnection, exception: ' + e.message);
            alert('Cannot create RTCPeerConnection object.');
        }
        return;
    }
    
    //-----------------------------------------------------------------
    //handler for the peer connection
    //-----------------------------------------------------------------
    //add new ice candidates
    function handleIceCandidate(evt) {
        console.log('New ICE candidate: ', evt);
        
        if(evt.candidate) {
            sendMessage({
                type: 'candidate',
                label: evt.candidate.sdpMLineIndex,
                id: evt.candidate.sdpMid,
                candidate: evt.candidate.candidate
            });
        } else {
            console.log('End of candidates');
        }
    }
    
    //add another peers video stream to your browser
    function handleRemoteStreamAdded(evt) {
        console.log('Remote stream added.');
        remoteVideo.src = window.URL.createObjectURL(evt.stream);
        remoteStream = evt.stream;
    }
    
    //delete a remote stream
    function handleRemoteStreamRemove(evt) {
        console.log('Removed a remote stream Event: ', evt);
    }
    
    //problem sending the offer to another peer
    function handleCreateOfferError(evt) {
        console.log('Create SDP-offer error: ', evt);
    }
    
    function onCreateSessionDescriptionError(error){
        console.log('Encountered an error while creating the SessionDescription: ', error);    
    }
    
    //-----------------------------------------------------------------
    //creating and sending sdp-offer
    //-----------------------------------------------------------------
    //offer creation
    function startOffer(data) {
        console.log('Sending offer to peer');
        $scope.partnerId = data.receiver;
        pc.createOffer(localAndSendPvtMsg, handleCreateOfferError);
    }
    
     function localAndSendPvtMsg(sessionDescription) {
        console.log('Sending the sesssion description: ', sessionDescription);
        //set the session description locally
        sendRTCMessage(sessionDescription);
        pc.setLocalDescription(sessionDescription);
    }
    
    //create RTC handshake - exchanging sdp
    function sendRTCMessage(sessionDescription) {
        //send the local session description via socketio to the other peer
        var data = {
            sender: $scope.setId,
            receiver: $scope.partnerId,
            message: sessionDescription.type,
            session: sessionDescription
        }
        socket.emit('sdp', data);
    }
    
    //-----------------------------------------------------------------
    //creating and sending sdp-answer
    //-----------------------------------------------------------------
    //init the client for answering
    function prepareAnswer() {
        console.log('Preparing sdp answer for the caller');
        console.log('Started: '+isStarted+' LocalStream: '+ localStream +' Channel Ready? '+ isChannelReady);
        if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
            console.log('Started Call Answer');
            //change button access - able to hang up on the caller
            $scope.gumedia = true;
            $scope.inCall = true;
        
            //create new RTCPeerConnection
        
            createPeerConnection();
            pc.addStream(localStream);
            isStarted = true;
        }  
    }
    
    //return an sdp answer for the other peers sdp offer        
    function answerPeer(sessionDescription) {
        console.log('Sending answer to peer');
        pc.createAnswer().then(
        localAndSendPvtMsg, onCreateSessionDescriptionError);   
    }  
    
    //-----------------------------------------------------------------
    //ending the currently running call
    //-----------------------------------------------------------------
    
    //stop a running p2p call
    $scope.hangUp = function() {
        console.log('Stopping the running call');
        stop();
        //disable hangup allow calling again
        sendMessage('bye');
    };
    
    //the caller has ended the call
    function handleRemoteHangup() {
        console.log('Caller has ended the call');
        if (isStarted) {
            stop();    
        }
    }
    
    function stop() {
        console.log('Stopping peer connection');
        isStarted = false;
        isInitiator = false;
        $scope.gumedia = !$scope.gumedia;
        $scope.inCall = false;
        //close the connection
        //pc.removeStream(remoteStream);
        remoteStream.getAudioTracks()[0].stop();
        remoteStream.getVideoTracks()[0].stop();
        pc.close;
        pc = null;
    }
    
    //end any calls when reloading or closing the page
    window.onbeforeunload = function() {
        sendMessage('bye');
    }
})
