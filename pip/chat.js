//Immediately Invoked Function Expression (IIFE)
(function() {
'use strict';

angular.module('chatApp')
.controller('ChatCtrl', function($scope, socket) {
    //view model to encapsulate $scope using controllerAs
    var vm = this;
    
    //client side implementation
    vm.userNames = [];          //list of usernames
    vm.name = null;             //own name
    var channelReady = false;   //check if localStream is available before calling
    var praxis = 'pr23';        //praxis number to create a peer id
    
    //show warning if no user media found or camera access granted
    vm.noMedia = false;
    vm.noCamera = false;
    //client states
    vm.gumedia = true;      //is client capable of using getUserMedia?
    vm.inCall = false;      //is client currently being called?
    vm.pids;                //Peer Ids of all connected clients 
    
    //stream elements to be displayed on the web page
    var localVideo = document.getElementById('localVideo'),
        remoteVideo = document.getElementById('remoteVideo');
    
    //send peer connection request to this id
    vm.peerId;  //id of the object to be called
    vm.ownId;   //set last id numbers yourself 
    vm.setId = praxis+''+vm.name+''+42; //standard
    vm.accepted = false; //has client answered a peer request?
    
    //Id of the other peer
    vm.partnerId;
    
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
    //view model functions
    //-----------------------------------------------------------------
    vm.getLocalVideo = getLocalVideo;   //receive local media stream
    vm.makeId = makeId;                 //create your own peer id
    vm.sendRequest = sendRequest;       //request connection with peer
    vm.hangUp = hangUp;                 //end a current call
    //-----------------------------------------------------------------
    //Socket io event handling
    //-----------------------------------------------------------------
    
    //check if getUserMedia is available
    if (navigator.mediaDevices === undefined) {
            vm.noMedia = true;
    }
    
    //ask for username upon connection
    socket.on('connect', function() {
        //prompt user to enter a username
       vm.name = prompt('Enter a username!');
        socket.emit('add:user', vm.name);
    });
    
    //listen for chat updates from the server
    socket.on('update:chat', function(username, data) {
        $('#conversation').append('<b>'+username+' :</b> ' + data + '<br>');
    });
    
    //listen for user changes
    socket.on('update:user', function(uData) {
        vm.userNames = uData;
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
        vm.pids = peerIds; 
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
            //handleRemoteHangup();
        }
    });
    
    //deal with private messages
    socket.on('get:pvtmsg', function(data) {
        //handle private message exchange between peers
        if (data.receiver === vm.setId) {
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
            } else if (data.message === 'bye' && isStarted) {
                handleRemoteHangup();
            } else {
                console.log('Received remote message!');
            } 
        }
    });
    
    //rtc handshake
    socket.on('rtc:msg', function(data) {
        //check if correct client
        if (data.receiver === vm.setId) {
            vm.partnerId = data.sender;
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
        console.log('Started: '+isStarted+' LocalStream: '+ localStream +' Channel Ready? '+ isChannelReady);
        if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
            console.log('ENTERED!!!')
            //change button access - able to hang up on the caller
            vm.gumedia = true;
            vm.inCall = true;
            if (vm.picReady) {
                vm.picSendReady = true;
            }
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
    function getLocalVideo(){
        receiveLocalVideo();
        //able to take pictures
        vm.canPhoto = true;
    }

    function receiveLocalVideo() {
        if (navigator.mediaDevices.getUserMedia !== 'undefined') {
            //get the video stream
            vm.gumedia = false;
            console.log('getUserMedia active');
            navigator.mediaDevices.getUserMedia({audio: true, video: true})
            .then(createStream)
            .catch(function(e) {
                vm.noCamera = true;
                alert('getUserMedia error: ' + e.name);
            });
            console.log('AFTER STREAM');
        } else {
            vm.noMedia = true;
            console.log('getUserMedia is not supported in this browser!');
        }
    }
    
    function createStream(stream){
        console.log('Adding local stream');
        localVideo.src = window.URL.createObjectURL(stream);
        localStream = stream;
        console.log('The local stream has been initialized: '+localStream);
        //sendMessage('got user media');
        //set photo dimensions
        //localVideo.onloadmetadata = function() {
        //}
        //got local stream --> can begin calling other peers
        isChannelReady = true;
    }
    
    
    //-----------------------------------------------------------------
    //request a new peer connection
    //-----------------------------------------------------------------
    
    //add your own id suffix
    function makeId() {
        //create an id from praxis number, username and suffix
        //complete version
        vm.setId = praxis+''+vm.name+''+vm.ownId;
        console.log('Setting own id from '+vm.setId+' to '+vm.ownId);
        //send complete peer id to all clients
        socket.emit('update:pid', vm.setId);
    }
    
    //request a peer connection from another client
    function sendRequest() {
        console.log('sending request to establish peer connection');
        var message = 'request';
        console.log('Check - '+vm.setId+' - '+vm.peerId);
        //dont request yourself
        if (vm.peerId !== vm.setId) {
            var a = vm.setId,
            b = vm.peerId,
            data = {
                sender: a,
                receiver: b,
                message: message
            };
            sendPrivateMessage(data);
            console.log('Value in peerId '+vm.peerId);   
        } else {
            console.log('You requested yourself');
            window.alert("You requested a connection with yourself. Please choose another peer Id.");
        }
    }
    
    function startRequest(data) {
        if (isChannelReady && !vm.inCall) {
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
        } else if (isChannelReady && vm.inCall){
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
            vm.gumedia = true;
            vm.inCall = true;
            if (vm.picReady) {
                vm.picSendReady = true;
            }
            //new connection
            isStarted = true;
            isInitiator = true;
            createPeerConnection();
            pc.addStream(localStream);
            
            //create the offer
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
            if (isInitiator) {
                console.log('Creating Data Channel');
                dataChannel = pc.createDataChannel('photos');
                onDataChannelCreated(dataChannel);

                console.log('Creating an offer');
            } else {
                pc.ondatachannel = function(event) {
                console.log('ondatachannel:', event.channel);
                dataChannel = event.channel;
                onDataChannelCreated(dataChannel);
              };
            }
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
        vm.partnerId = data.receiver;
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
            sender: vm.setId,
            receiver: vm.partnerId,
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
            vm.gumedia = true;
            vm.inCall = true;
            if (vm.picReady) {
                vm.sendPicReady = true;
            }
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
    function hangUp() {
        console.log('Stopping the running call');
        stop();
        //disable hangup allow calling again
        var quitData = {
            sender: vm.setId,
            receiver: vm.partnerId,
            message: 'bye'
        }
        sendPrivateMessage(quitData);
    };
    
    //the caller has ended the call
    function handleRemoteHangup() {
        console.log('Caller has ended the call');
        stop();    
    }
    
    function stop() {
        console.log('Stopping peer connection');
        isStarted = false;
        isInitiator = false;
        vm.gumedia = !vm.gumedia;
        vm.inCall = false;
        vm.picSendReady = false;
        //close the connection
        //pc.removeStream(remoteStream);
        //check if tracks are available
        try {
            remoteStream.getAudioTracks()[0].stop();
            remoteStream.getVideoTracks()[0].stop();  
        }catch (e) {
            console.log('Error closing the stream tracks '+e);
        }
        pc.close;
        pc = null;
    }
    
    //end any calls when reloading or closing the page
    window.onbeforeunload = function() {
        var quitData = {
            sender: vm.setId,
            receiver: vm.partnerId,
            message: 'bye'
        }
        sendPrivateMessage(quitData);
    }
    
    //-----------------------------------------------------------------
    //capture a picture and send it over the RTC data channel
    //-----------------------------------------------------------------
    var photo = document.getElementById('photo');
    var trail = document.getElementById('trail');
    var photoContext = photo.getContext('2d'); 
    //set picture dimensions
    var photoContextW,
        photoContextH;
    
    //the data channel to send byte data through
    var dataChannel;
    
    //picture ready to send
    vm.canPhoto = false;
    vm.picReady = false;
    vm.picSendReady = false;
    
    vm.snapPhoto = snapPhoto;
    vm.sendPhoto = sendPhoto;
    
    function snapPhoto() {
        adjustCanvasSize(localVideo);
        photoContext.drawImage(localVideo, 0, 0, photo.width, photo.height);
        vm.picReady = true;
        if (vm.inCall) {
            vm.picSendReady = true;
        }
    }
    
    function sendPhoto() {
        //check if in call and a photo is available
        if (vm.picReady && vm.inCall) {
            //split data in 64KB chunks
            var CHUNK_LEN = 64000;
            var img = photoContext.getImageData(0, 0, photoContextW, photoContextH),
                len = img.data.byteLength,  //number of bytes to send
                n = len / CHUNK_LEN | 0;    //number of chunks
            
            console.log('Sending a total of '+len+' bytes');
            //send image data
            dataChannel.send(len);
            
            //send individual chunks
            for (var i = 0; i < n; i++) {
                var start = i * CHUNK_LEN,
                    end = (i + 1) * CHUNK_LEN;
                console.log(start+' - '+ (end - 1));
                dataChannel.send(img.data.subarray(start, end));
            }
            
            //send any rest
            if (len % CHUNK_LEN) {
                console.log('last '+len % CHUNK_LEN+' bytes');
                dataChannel.send(img.data.subarray(n * CHUNK_LEN));
            }
        }
    }
    
    //create the data channel to send images
    function onDataChannelCreated(channel) {
        console.log('Created Data Channel:', channel);

        channel.onopen = function() {
        console.log('CHANNEL has been opened!!!');
        };

        channel.onmessage = (adapter.browserDetails.browser === 'firefox') ?
        receiveDataFirefoxFactory() : receiveDataChromeFactory();
    }
    
    function receiveDataChromeFactory() {
        var buf, count;

        return function onmessage(event) {
        if (typeof event.data === 'string') {
            buf = window.buf = new Uint8ClampedArray(parseInt(event.data));
            count = 0;
            console.log('Expecting a total of ' + buf.byteLength + ' bytes');
            return;
        }

        var data = new Uint8ClampedArray(event.data);
        buf.set(data, count);

        count += data.byteLength;
        console.log('count: ' + count);

        if (count === buf.byteLength) {
        // we're done: all data chunks have been received
        console.log('Done. Rendering photo.');
        renderPhoto(buf);
        }
        };
    }

    function receiveDataFirefoxFactory() {
      var count, total, parts;

      return function onmessage(event) {
        if (typeof event.data === 'string') {
          total = parseInt(event.data);
          parts = [];
          count = 0;
          console.log('Expecting a total of ' + total + ' bytes');
          return;
        }

        parts.push(event.data);
        count += event.data.size;
        console.log('Got ' + event.data.size + ' byte(s), ' + (total - count) +
                    ' to go.');

        if (count === total) {
          console.log('Assembling payload');
          var buf = new Uint8ClampedArray(total);
          var compose = function(i, pos) {
            var reader = new FileReader();
            reader.onload = function() {
              buf.set(new Uint8ClampedArray(this.result), pos);
              if (i + 1 === parts.length) {
                console.log('Done. Rendering photo.');
                renderPhoto(buf);
              } else {
                compose(i + 1, pos + this.result.byteLength);
              }
            };
            reader.readAsArrayBuffer(parts[i]);
          };
          compose(0, 0);
        }
      };
    }
    
    //receiving photo data through the rtc data channel
    function renderPhoto(data) {
        adjustCanvasSize(remoteVideo);
        var canvas = document.createElement('canvas');
        canvas.width = photoContextW;
        canvas.height = photoContextH;
        canvas.classList.add('incomingPhoto');
        // trail is the element holding the incoming images
        trail.insertBefore(canvas, trail.firstChild);

        var context = canvas.getContext('2d');
        var img = context.createImageData(photoContextW, photoContextH);
        img.data.set(data);
        context.putImageData(img, 0, 0);    
    }
    
    function adjustCanvasSize(video) {
        var h = video.videoHeight;
        var w = video.videoWidth;
        photo.width = photoContextW = w;
        photo.height = photoContextH = h;
        console.log('Height '+h+' Width '+w); 
    }
})
})();