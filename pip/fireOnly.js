//new navigator -- doesnt work in chrome 

var p = navigator.mediaDevices.getUserMedia({audio:true, video:true});
    p.then(function(mediaStream) {
        var video = document.getElementById('myVideo');
        video.src= window.URL.createObjectURL(mediaStream);
    });
    
    //check for errors
    p.catch(function(err) {
        console.log(err.name);
    });



-------------------------------------------
    function createPeerConnection() {
        peerConn = new RTCPeerConnection(peerConnCfg);
        
        peerConn.onicecandidate = function(evt) {
            //check if working
            var msg = '{type: "candidate",'+ evt.candidate + '}';
            socket.emit('ice:candidate', msg)
        };
        
        peerConn.onaddstream = function(evt){
          theirVideo.src = URL.createObjectURL(evt.stream);  
        };
        
        peerConn.addStream(localStream);
    }
    
    //set constraints for what we want to receive
    var mediaConstraints = {
        'mandatory': {
            'OfferToReceiveAudio': true,
            'OfferToReceiveVideo': true
        }
    };
    
    function setLocalandSendMessage(sessionDescription) {
        peerConn.setLocalDescription(sessionDescription);
        socket.emit('set:session', sessionDescription);
    }
    
    //create an offer for a peer
    peerConn.createOffer(setLocalandSendMessage, errorCallback, mediaConstraints);
    
    //need new message for socket?
    socket.on('message', onMessage);
    
    function onMessage(evt) {
        //receive sdp offer from peer
        if (evt.type === 'offer') {
            if (!started) {
                createPeerConnection;
                started = true;
            }
            peerConn.setRemoteDescription(new RTCSessionDescription(evt));
            peerConn.createAnswer(setLocalandSendMessage,
                                 errorCallback,
                                 mediaConstraints);
        } else if (evt.type === 'answer' && started) {
            peerConn.setRemoteDescription(new RTCSessionDescription(evt));
        } else if (evt.type === 'candidate' && started) {
            var candidate = new RTCIceCandidate(evt.candidate);
            peerConn.addIceCandidate(candidate);
        }
    }