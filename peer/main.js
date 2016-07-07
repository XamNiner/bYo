$(function() {
var FADE_TIME = 150; // ms
    var TYPING_TIMER_LENGTH = 400; // ms
    var COLORS = [
        '#e21400', '#91580f', '#f8a700', '#f78b00',
        '#58dc00', '#287b00', '#a8f07a', '#4ae8c4',
        '#3b88eb', '#3824aa', '#a700ff', '#d300e7'
        ];
    //new variables for the chat
    var $window = $(window),
        $usernameInput = $('.usernameInput'),
        $messages = $('.messages'),
        $inputMessage = $('.inputMessage');
    
    var $loginPage = $('.login.page'),
        $chatPage = $('.chat.page');
    
    //enter user name
    var username,
        connected = false,
        typing = false,
        lastTypingTime,
        $currentInput = $usernameInput.focus();
    
    function addParticipantsMessage(data) {
        var message = '';
        if (data.numUsers === 1) {
            message += "there is 1 participant.";
        } else {
            message += "there are" + data.numUsers + "participants.";
        }
        log(message);
    }
    
    function setUsername() {
        username = cleanInput($usernameInput.val().trim());
        
        //check validity
        if (username) {
            $loginPage.fadeOut();
            $chatPage.show();
            $loginPage.off('click');
            $currentInput = $inputMessage.focus();
            
            //tell server new name
            socket.emit('add user', username);
        }
    }
    
    function sendMessage() {
        var message = $inputMessage.val();
        message = cleanInput(message);
        if(message && connected) {
            $inputMessage.val('');
            addChatMessage({
                username: username,
                message: message
            });
            socket.emit('new message', message);
        }
    }
    
    //logging messages
    function log(message, options){
        var $el = $('<li>').addClass('log').text(message);
        addMessageElement($el, options);
    }
    
    //visualize the message
    function addChatMessage(data, options) {
        var $typingMessages = getTypingMessages(data);
        options = options || {};
        if ($typingMessages.length !== 0) {
            options.fade = false;
            $typingMessages.remove();
        }
        
        var $usernameDiv = $('<span class="username" />')
            .text(data.username)
            .css('color', getUsernameColor(data.username));
        var $messageBodyDiv = $('<span class="messageBody">')
            .text(data.message);
        
        var typingClass = data.typing ? 'typing' : '';
        var $messageDiv = $('<li class="message"/>')
            .data('username', data.username)
            .addClass(typingClass)
            .append($usernameDiv, $messageBodyDiv);
        
        addMessageElement($messageDiv, options);
    }
    
    //typing the visual
    function addChatTyping(data) {
        data.typing = true;
        data.message = 'is typing';
        addChatMessage(data);
    }
    
    //remove typing message
    function removeChatTyping(data) {
        getTypingMessages(data).fadeOut(function() {
           $(this).remove(); 
        });
    }
    
    //adding a message element to the page and scrolls to the bottom
    function addMessageElement(el, options) {
        var $el = $(el);
        
        //default options
        if(!options) {
            options = {};
        }
        
        if(typeof options.fade === 'undefined') {
            options.fade = true;
        }
        
        if (typeof options.prepend === 'undefined') {
            options.prepend = false;
        }
        
        //apply selected options
        if (options.fade) {
            $el.hide().fadeIn(FADE_TIME);
        }
        if(options.prepend) {
            $messages.prepend($el);
        } else {
            $messages.append($el);
        }
        $messages[0].screenTop = $messages[0].scrollHeight;
    }
    
    function cleanInput(input) {
        return $('<div/>').text(input).text();
    }
    
    function updateTyping() {
        if (connected) {
            if(!typing) {
                typing = true;
                socket.emit('typing');
            }
            lastTypingTime = (new Date()).getTime();
            
            setTimeout(function (){
                var typingTimer = (new Date()).getTime();
                var timeDiff = typingTimer - lastTypingTime;
                if(timeDiff >= TYPING_TIMER_LENGTH && typing) {
                    socket.emit('stop typing');
                    typing = false;
                }
            }, TYPING_TIMER_LENGTH);
        }
    }
    
    //set color for a username
    function getUsernameColor(username) {
        //compute hash color value
        var hash = 7;
        for (var i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + (hash << 5) - hash;
        }
        //calculate a new color
        var index = Math.abs(hash % COLORS.length);
        return COLORS[index];
    }
    
    //keyboard events
    $window.keydown(function(event) {
        if (!event.ctrlKey || event.metaKey || event.altKey) {
            $currentInput.focus();
        }
        //react to enter key pressed
        if (event.which === 13) {
            if(username) {
                sendMessage();
                socket.emit('stop typing');
                typing= false;
            } else {
                setUsername();
            }
        }
    });
    
    $inputMessage.on('input', function() {
        updateTyping();
    });
    
    //click event
    $loginPage.click(function() {
        $currentInput.focus();
    });
    
    $inputMessage.click(function() {
        $inputMessage.focus();
    });
    
    
    //socket events to handle
    //display connection message for new clients
    socket.on('login', function(data) {
        connected = true;
        //msg display
        var message = "Welcome to the chat";
        log(message, {
            prepend: true
        });
        addParticipantsMessage(data);
    });
    
    //server emits new message
    socket.on('new message', function(data) {
        addChatMessage(data);
    });
    
    socket.on('user joined', function(data) {
       log(data.username+ ' joined');
        addParticipantsMessage(data);
    });
    
    socket.on('user left', function(data) {
        log(data.username + ' left');
        addParticipantsMessage(data);
        removeChatTyping(data);
    });
    
    socket.on('typing', function(data) {
        addChatTyping(data);
    });
    
    socket.on('stop typing', function(data) {
        removeChatTyping(data);
    });
});