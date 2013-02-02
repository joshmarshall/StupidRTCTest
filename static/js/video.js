(function() {

  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia || navigator.msGetUserMedia;

  if (!navigator.getUserMedia) {
    alert("WebRTC is not supported for you. :( Get some new hotness and come back.");
    return;
  }

  if (!WebSocket) {
    alert("WebSocket is not supported for you. :( Get some new hotness and come back.");
  }

  if (!Worker) {
    alert("Workers are not supported for you. :( Get some new hotness and comeback.");
  }

  var minTimeout = 100;
  var maxTimeout = 1500;
  var clients = 1;
  var maxClients = 50;

  var userId = "";
  var letters = "abcdefghijklmnopqrstuvwxyz";
  letters += letters.toUpperCase();
  letters += "0123456789";
  while (userId.length < 8) {
    userId += letters[Math.floor(Math.random() * letters.length)];
  }
  console.log("YOU ARE USER " + userId);

  var source = document.createElement("video");
  var sourceEncode = document.createElement("canvas");
  var image = new Image();


  sourceEncode.width = 120;
  sourceEncode.height = 120;
  var sourceEncodeContext = sourceEncode.getContext("2d");

  navigator.getUserMedia({video:true}, function(localMediaStream) {
    $("#waiting").hide();
    $("#controls").show();
    source.src = window.URL.createObjectURL(localMediaStream);
    source.play();
    updateFrame();
    connect();
  });

  var setupPosition = function() {
    var sourceWidth = source.videoWidth;
    var sourceHeight = source.videoHeight;

    if (!sourceWidth && !sourceHeight) {
      return null;
    }

    var sourceEncodeAspect = sourceEncode.width / sourceEncode.height;
    var sourceAspect = sourceWidth / sourceHeight;

    var width = sourceEncode.width;
    var height = sourceEncode.height;

    if (sourceAspect > sourceEncodeAspect) {
      width = height * sourceAspect;
    } else {
      height = width / sourceAspect;
    }

    var topOffset = Math.floor((sourceEncode.height - height) / 2);
    var leftOffset = Math.floor((sourceEncode.width - width) / 2);

    return {
      width: width,
      height: height,
      x: leftOffset,
      y: topOffset
    };

  };

  var positioned = null;
  var timeoutIntervals = (maxTimeout - minTimeout) / maxClients;

  var updateFrame = function() {

    var timeoutModifier = timeoutIntervals * (clients - 1);
    var timeout = minTimeout + timeoutModifier;
    window.setTimeout(updateFrame, timeout);
    positioned = positioned || setupPosition();
    if (!positioned) {
      return;
    }
    sourceEncodeContext.drawImage(source, positioned.x, positioned.y,
      positioned.width, positioned.height);
    socket.send(JSON.stringify({
      type: "image",
      user: userId,
      data: sourceEncode.toDataURL("image/jpeg", 0.4)
    }));
  };

  var socket;

  var events = {
    image: function(message) {
      var avatar = document.getElementById(message.user + "-avatar");
      if (!avatar) {
        if (clients >= maxClients) {
          console.log("Skipping newbie -- too many clients already.");
          return;
        }

        avatar = document.createElement("canvas");
        avatar.width = 120;
        avatar.height = 120;
        avatar.className = "avatar";
        avatar.id = message.user + "-avatar";

        var container = $("<div class='container' id='" + message.user + "'/>");
        container.append(avatar);
        if (message.user != userId) {
          container.append("<div class='textbubble' id='" + message.user + "-message'/>");
        } else {
          container.append("<textarea id='message' class='textbubble'></textarea>");
        }
        $("body").append(container);
        if (message.user == userId) {
          setupText();
        }
        clients += 1;
      }
      var avatarContext = avatar.getContext("2d");
      image.onload = function() {
        avatarContext.drawImage(image, 0, 0);
      };
      image.src = message.data;
    },

    text: function(message) {
      var talk = document.getElementById(message.user + "-message");
      $(talk).text(message.text);
    },

    close: function(message) {
      var container = document.getElementById(message.user);
      if (container) {
        container.parentElement.removeChild(container);
        clients -= 1;
      }
    }
  };

  var connect = function() {
    socket = new WebSocket("ws://" + window.location.host + "/websocket");
    socket.onopen = function() {
      console.log("WE ARE OPEN.");
    };

    socket.onmessage = function(message) {
      message = JSON.parse(message.data);
      if (!message.type) {
        console.log("No type for message, skipping.");
        return;
      }

      events[message.type](message);

    };

    socket.onclose = function() {
      console.log("WE ARE CLOSED.");
      window.setTimeout(connect, 5000);
    };
  };

  var setupText = function() {
    $("#message").on("keyup", function(e) {
      var message = $("#message").val();
      if (message) {
        socket.send(JSON.stringify({
          user: userId,
          type: "text",
          text: message
        }));
      }
      if (e.keyCode == 13) {
        $("#message").val("");
      }
    });
    document.getElementById("message").focus();
  };

})();
