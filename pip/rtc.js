var myVideo = null,
    theirVideo = null,
    myVidStream = null,
    vidCallButton = null,
    endCallButton = null;

var wsc = new WebSocket('wss:https://localhost:3000'), 
    peerConn = null,
    peerConnCfg = {'iceServers': 
      [{'url': 'stun:stun.services.mozilla.com'}, {'url': 'stun:stun.l.google.com:19302'}]
    };
    
function pageReady() {
    vidCallButton = document.getElementById("vidCallButton");
    endCallButton = document.getElementById("endCallButton");
    myVideo = document.getElementById("myVideo");
    theirVideo = document.getElementById("theirVideo");
    
    //check availability of webRTC
    checkRTC();
}

function checkRTC(){
    if (navigator.getUserMedia) {
        vidCallButton = document.getElementById("vidCallButton");
        endCallButton = document.getElementById("endCallButton");
        myVideo = document.getElementById('myVideo');
        theirVideo = document.getElementById('theirVideo');
        
        vidCallButton.removeAttribute("disabled");
        vidCallButton.addEventListener("click", initiateCall());
        endCallButton.addEventListener("click", function(evt) {
            wsc.send(JSON.stringify( {"closeConnection": true} ));
        });
    } else {
        alert("No support for WebRTC in your browser!");
    }
};

//message exchange using websockets
wsc.onmessage = function(evt) {
    var signal = JSON.parse(evt.data);
    //client is being called by a remote peer
    if(!peerConn) {
        //automatically answer - might need to change to ask for permission
        answerCall();
    }
    
    if(signal.sdp) {
        peerConn.setRemoteDescription(new RTCSessionDescription(signal.sdp));
    } else if(signal.candidate) {
        peerConn.addIceCandidate(new RTCIceCandidate(signal.candidate));
    } else if(signal.closeConnection) {
        //remove stream objects and set buttons
        endCall();
    }
};

//call a remote peer
function initiateCall(){
    prepareCall();
    navigator.getUserMedia({"audio": true, "video": true}, function(stream) {
        myVideo.src = URL.createObjectURL(stream);
        peerConn.addStream(stream);
        createAndSendOffer();
    }, function(error){console.log(error);});
};

//create peer connection and assign needed listeners
function prepareCall(){
    peerConn = new RTCPeerConnection(peerConnCfg);
    peerConn.onicecandidate = onIceCandidateHandler;
    peerConn.onaddstream = onAddStreamHandler;
}

//handle new ice candidates and streams
function onIceCandidateHandler(evt){
    if (!evt || !evt.candidate){
        //forward any new ice candidates to the server
        wsc.send(JSON.stringify({"candidate": evt.candidate}));
    }
};

function onAddStreamHandler(evt) {
    vidCallButton.setAttribute("disabled", true);
    endCallButton.removeAttribute("disabled");
    //assign remote peer stream to a video element
    theirVideo.src = URL.createObjectURL(evt.stream);
};

//invite a peer to a video chat
function createAndSendOffer() {
    //offer contains information about how the peers are about to be connected
    //video codecs and ice/sdp
    peerConn.createOffer(
        function(offer) {
            var off = new RTCSessionDescription(offer);
            peerConn.setLocalDescription(new RTCSessionDescription(off),
                function() {
                    wsc.send(JSON.stringify({"sdp": off}));
                },
                function(error) {
                    console.log(error);
                }
            );
        }, function(error) {
            console.log(error);
        }
    );
};

function answerCall() {
    prepareCall();
    //display the local stream and send it
    navigator.getUserMedia({"audio": true, "video": true}, function(stream) {
        myVideo.src = URL.createObjectURL(stream);
        peerConn.addStream(stream);
        //prepare answer and send it using web sockets
        createAndSendAnswer();
        
    }, function(error){console.log(error);});
};

function createAndSendAnswer() {
    peerConn.createAnswer(
        function(answer) {
            var ans = new RTCSessionDescription(answer);
            peerConn.setLocalDescription(ans, function() {
                //send msg to signaling server to broadcast to other clients
                wsc.send(JSON.stringify({"sdp": ans}));
            }, function(error) {
                console.log(error);
                }
            );
        }, function(error) {
            console.log(error);
           }
    );
};

//close a running peer connection
function endCall() {
    peerConn.close();
    myVidStream.getTracks().forEach(function(track) {
        track.stop();
    });
    myVideo.src = "";
    theirVideo.src = "";
    //re-enable the video call button
    vidCallButton.removeAttribute("disabled");
    endCallButton.setAttribute("disabled", true);
};
