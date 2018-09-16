$(() => {

  const $mainContent = $('.main-content'); // which contains userlist and search functionality
  let username = ''; // variable to store username entered.
  const $usernameInput = $('.usernameInput'); // Input for username
  const $loginPage = $('.login-page'); // the login form area
  const $window = $(window);
  const $homePage = $('.home-page'); // home page
  const $transferPage = $('.transfer-page'); // file transfer page
  const $progressBar = $('.progress_bar'); // prgress bar
  const $chatbox = $('.chat');
  const socket = window.io();  
  const $alertUsername = $('.alert-username');
  const $transferPageHeader = $('.user-name');
  const $alertUsernameBlank = $('.alert-blankusername');
  const $listOfUsers = $('#listOfUsers');
  const $cancelButton = $('#waiting_message .cancel-button button');
  const fileSendButton = $('#file-send-button');
  const $downloadAnchor = $('#download');
  const statusMessage = document.getElementById('status');

  const TURN_SERVER_IP = env.IP;
  let offersForMe = [];

  const configuration = {
    // Needed for RTCPeerConnection
    iceServers: [
      {
        urls: "TURN_SERVER_IP:3478",
        credential: 'test',
        username: 'test',
      },
    ],
  };

  let client;
  let ExchangerUsername; // variable for name of requested username
  
  let fileRec;
  let file;
  let sender = false; // to maintain state of the client(whether he/she is a sender or a receiver)

  // message
  const chats = document.getElementById('chats');
  const message = document.getElementById('btn-input');
  const sendButton = document.getElementById('btn-chat');
  const typing = document.getElementById('typing');

  function cleanInput(input) {
    // Prevents input from having injected marku
    return $('<div/>').text(input).text();
  }

  function cancelConnection() {
    offersForMe = [];
    socket.partner = null;
    socket.partnerid = null;

    $transferPage.fadeOut();
    $progressBar.fadeOut();
    $homePage.show();
    $transferPageHeader.html('');
    $downloadAnchor.fadeOut();
    $downloadAnchor.prop('href', '');
    $downloadAnchor.html('');
    // Clear the requests
    $('.request-list').html('');

    ExchangerUsername = null;
    // offerComplete = false;
    sender = false;
    if (client !== null) {
      client.destroy();
      client = null;
    }
  }

  function requestHandler(answer, btn) {
    const requestingUsername = btn.parent().parent()[0].textContent;
    if (answer === 'y') {
      socket.partner = requestingUsername;
      socket.partnerid = offersForMe[requestingUsername];
      
      //    if request accepted
      ExchangerUsername = requestingUsername;
      // Set data-channel response on the other end(the client who receives the offer)
      $homePage.hide();
      $transferPage.fadeIn();
      $transferPageHeader.html(`<p>You are now connected to ${socket.partner}. To go back click <a href="#" class="alert-link" id="backLink"> here </a>. </p>`);
    } else {
      //    if request rejected
      btn.parent().parent().remove();
    }
    socket.emit('answer', {
      username: requestingUsername,
      answer,
    });

  }

  //creates a new webtorrent client
  function getClient() {
    client = new WebTorrent({
      tracker: { rtcConfig: configuration },
    });
    client.on('error', (err) => { alert(err); });
    client.on('warning', (w) => { alert(w); });
  }

  function sendData() {
    $('#fileBeingSent').text(`${file.name} ( ${Math.round(file.size / 1000)}  KB)`);

    getClient();
    const torrent = client.seed(file, () => {});

    torrent.on('infoHash', () => {
      // console.log(torrent.magnetURI);
      socket.emit('send', {
        user: ExchangerUsername,
        hash: torrent.magnetURI,
      });
    });
  }

  $('#download').hide();

  $('window.onbeforeunload').click((e) => {
    e.preventDefault();
  });

  $('#container div canvas').hide();

  $('#backLink').click(() => {
  });

  $window.keydown((event) => {
    // When the client hits ENTER on their keyboard
    if (event.which === 13) {
      event.preventDefault();
      username = cleanInput($usernameInput.val().trim()); // trim is to remove extra blank spaces
      $('#welcomeLine').html(`Welcome ${username} !`);

      socket.emit('login', username); // This sends a request to login with certain username

      socket.on('login', (status) => {
        if (status === 2) {
          $usernameInput.val('');
          $alertUsernameBlank.fadeIn(300).delay(2000).fadeOut(300);
        } else if (status === 1) {
          $usernameInput.val('');
          $alertUsername.fadeIn(300).delay(2000).fadeOut(300);
        } else {
          $loginPage.hide();
          $mainContent.fadeIn();
          $progressBar.hide();
          $loginPage.off('click');
        }
      });
    }
  });

  $('#file-1').change(() => {
    const input = document.getElementById('file-1');
    [file] = input.files;
    $('#file-desc').text(file.name);
  });

  fileSendButton.click(() => {
    const input = document.getElementById('file-1');
    if (!input) {
      alert("Um, couldn't find the fileinput element.");
      return;
    } else if (!input.files) {
      alert("This browser doesn't seem to support the `files` property of file inputs.");
      return;
    } else if (!input.files[0]) {
      alert("Please select a file before clicking 'Load'");
      return;
    }
    [file] = input.files;

    const fileStatus = `<li class = 'chatbox-file-history-sent'>  Sending  ${file.name} to ${ExchangerUsername}. </li>`;
    $(fileStatus).appendTo($chatbox);

    statusMessage.textContent = '';
    $('#file1').attr('aria-valuenow', 0).css('width', '0%');
    $downloadAnchor.fadeOut();

    if (file == null) alert('No file selected');
    if (file.size === 0) {
      statusMessage.textContent = 'File is empty, please select a non-empty file';
      alert('File is empty, please select a non-empty file');
      return;
    }
    sender = true;
    socket.emit('file-desc', {
      target: ExchangerUsername,
      fileData: {
        size: file.size,
        name: file.name,
        type: file.type,
        lastModifiedDate: file.lastModifiedDate,
      },
    });
  });

  $(document).on('click', '.online-user', function clickList() {
    // code for what happens when user clicks on a list item of online_users
    const targetUsername = $(this).text();
    socket.emit('offer', targetUsername);
    $('#waiting_message').find('.modal-body').html(`<h3>Waiting for confirmation from ${targetUsername}</h3>`);
    ExchangerUsername = targetUsername;// all this is from the one who sends request to other

    $cancelButton.on('click', () => {
      socket.emit('cancel', targetUsername);
    });
  });


  $(document).on('click', '.user-name a', () => {
    //   cancel the for both users
    // console.log('Connection terminated');
    socket.emit('Cancel Connection', ExchangerUsername);
    cancelConnection();
  });

  $(document).on('click', '#user-requests .btn-success', function requestHandle() {
    // code for what happens when user clicks on a list item that is a yes to a particular request
    requestHandler('y', $(this));
  });

  $(document).on('click', '#user-requests .btn-danger', function requestHandle() {
    // code for what happens when user clicks on a list item that is a no to a particular request
    requestHandler('n', $(this));
  });

  $('#stop-progress').click(() => {
    client.destroy();
    client = null;
    sender = false;
    fileSendButton.prop('disabled', false);

    socket.emit('reject', ExchangerUsername);
    $('#fileProgress').text('Cancelled');

    const fileStatus = '<li class = \'chatbox-file-history-cancel\'>  You cancelled file transfer. </li>';
    $(fileStatus).appendTo($chatbox);
  });

  // messages
  sendButton.addEventListener('click', () => {
    if (message.value) {
    //   const messagetime = new Date().getTime() / 1000;
      socket.emit('message', {
        message: message.value, socket: socket.partnerid, username, time: message,
      });
      chats.innerHTML += `${"<li class='right clearfix'><span class='chat-img pull-right'><img src='/images/ME.png' alt='User Avatar' class='img-circle' /></span><div class='chat-body clearfix'><div class='header'><small class=' text-muted'><span class='glyphicon glyphicon-time'></span><span class = 'time'>0</span><span class= 'timeunit'> mins</sapn> ago</small><strong class='pull-right primary-font'> You </strong></div><p>"}${message.value}</p></div></li>`;
      message.value = '';
    }
  });

  message.addEventListener('keyup', (e) => {
    if (e.keyCode === 13) {
      if (message.value) {
        // const messagetime = new Date().getTime() / 1000;
        socket.emit('message', {
          message: message.value, socket: socket.partnerid, username, time: message,
        });
        chats.innerHTML += `${"<li class='right clearfix'><span class='chat-img pull-right'><img src='/images/ME.png' alt='User Avatar' class='img-circle' /></span><div class='chat-body clearfix'><div class='header'><small class=' text-muted'><span class='glyphicon glyphicon-time'></span><span class = 'time'>0</span><span class = 'timeunit'> mins</span> ago</small><strong class='pull-right primary-font'> You </strong></div><p>"}${message.value}</p></div></li>`;
        message.value = '';
      }
    }
  });

  message.addEventListener('keydown', () => {
    socket.emit('typing', { socket: socket.partnerid, username });
  });


  socket.on('offer', (data) => {

    offersForMe[data.username] = data.pid;
    // show that username wants to connect to you
    const requestList = $('.request-list');

    // create a new list element and prepend it to the existing list
    let newRequest = `<li id="request-li">${data.username}`;
    newRequest += '<span class="request-btn">';
    newRequest += '<a class="btn btn-success" href="#"><i class="fa fa-check" aria-hidden="true"></i></a>';
    newRequest += '<a class="btn btn-danger" href="#"><i class="fa fa-times" aria-hidden="true"></i></a>';
    newRequest += '</span></li>';

    $(newRequest).prependTo(requestList);
  });

  socket.on('updateUsersList', (onlineUsers) => {
    let html = '';
    for (let i = 0; i < onlineUsers.length; i += 1) {
      if (onlineUsers[i] !== username) {
        html += `<div class="user"><button type="button" class="btn btn-default btn-block online-user" data-toggle="modal" data-target="#waiting_message">${onlineUsers[i]}</button> </div>`;
      }
    }
    $listOfUsers.html(html);
  });

  socket.on('answer', (msg) => {
    $('#waiting_message').modal('hide');

    const { answer } = msg;
    if (answer === 'y') {
      socket.partner = msg.partner;
      socket.partnerid = msg.partnerid;

      socket.emit('ack', msg);
      // stop the progress loader
      $homePage.hide();
      $transferPage.fadeIn();
      const $transferPageHeader = $('.user-name');
      $transferPageHeader.html(`<p>You are now connected to ${socket.partner}. To go back click <a href="#" class="alert-link" id="backLink"> here </a>. </p>`);
    } else {
      // remove modal after informing partner has said no
      ExchangerUsername = null; // else set ExchangeUsername to None
    }
  });

  socket.on('file-desc', (fileDesc) => {
    if (!sender) {
      fileRec = {
        name: fileDesc.name,
        size: fileDesc.size,
        type: fileDesc.type,
        lastModifiedDate: fileDesc.lastModifiedDate,
      };
      
      socket.emit('file accepted', {
        target: ExchangerUsername,
        from: username,
        file: fileDesc.name,
      });

      //disable send button so that only one file is sent at time
      fileSendButton.prop('disabled', true);
      $('#file1').attr('aria-valuenow', 0).css('width', '0%');
      $('#fileBeingSent').text(`${fileRec.name}(${Math.round(fileRec.size / 1000)} KB) (receiving..)`);
    } else {
      sender = false; // if both have sent at the same time, cancel both
      socket.emit('file refused', ExchangerUsername);
    }
  });

  socket.on('file refused', () => {
    sender = false;
  });

  socket.on('file accepted', (data) => { // This is for sender's end. Here funtion gets the username of the user he will now send the file to
    // here's the sendData!

    $progressBar.fadeIn();
    $('#stop-progress').html('Cancel');
    $('#fileProgress').text('Establishing Connection');

    sendData(); // start sending :)))
  });


  socket.on('send', (hash) => { //this callback contains the whole sending process
    getClient();

    const fileStatus = `<li class = 'chatbox-file-history-recieved'>  Receiving  ${fileRec.name} from ${ExchangerUsername}. </li>`;
    $(fileStatus).appendTo($chatbox);

    $progressBar.fadeIn();
    $('#stop-progress').html('Cancel');
    $('#fileProgress').text('Establishing Connection');

    client.add(hash, (torrent) => { //torrent created
      [file] = torrent.files;

      torrent.on('error', (err) => { alert(err); });

      torrent.on('download', () => {
        $progressBar.fadeIn();
        const progress = torrent.progress * 100;
        $('#file1').attr('aria-valuenow', progress).css('width', `${progress}%`);
        $('#fileProgress').text(`Progress- ${Math.round(progress)}%`);

        socket.emit('progress', {
          user: ExchangerUsername,
          prog: progress,
        });
      });

      torrent.on('done', () => {
        [file] = torrent.files;

        $progressBar.fadeOut();

        // class of the chat/file share history ul is chat
        const filehistory = `<li class = 'chatbox-file-history-recieved'>  You recieved  ${file.name} from ${ExchangerUsername}. </li>`;
        $(filehistory).appendTo($chatbox);// delivering file history to chat box

        file.getBlobURL((error, url) => {
          if (error) { alert(error); return; }

          $downloadAnchor.prop('href', url);
          $downloadAnchor.prop('download', file.name);
          $downloadAnchor.text(`Download ${file.name}`);
          $('#download').show();

          client.destroy();
          client = null;
          fileSendButton.prop('disabled', false);
        });
      });
    });
  });

  socket.on('progress', (progress) => {
    $('#file1').attr('aria-valuenow', progress).css('width', `${progress}%`);
    $('#fileProgress').text(`Progress- ${Math.round(progress)}%`);
    if (progress === 100) {
      client.destroy();
      client = null;
      sender = false;

      $progressBar.fadeOut();
      const filehistory = `<li class = 'chatbox-file-history-sent'>  You sent ${file.name} to ${ExchangerUsername}.  </li>`;
      $(filehistory).appendTo($chatbox);// delivering file history to chat box of the sender
    }
  });

  socket.on('reject', () => {
    client.destroy();
    client = null;

    $('#fileProgress').text('Cancelled');

    const fileStatus = `<li class = 'chatbox-file-history-cancel'>  Transfer cancelled by ${ExchangerUsername}. </li>`;
    $(fileStatus).appendTo($chatbox);

    sender = false;
    fileSendButton.prop('disabled', false);
  });

  socket.on('PartnerDisconnected', () => {
    // stop transfer or show dialog that partner has been disconnected retry from main page
    alert('Your partner has disconnected');
    cancelConnection();
  });

  socket.on('Cancel Connection', () => {
    cancelConnection();
  });

  socket.on('cancel', (dat) => {
    // console.log(dat);
    let html = '';
    const $requestList = $('.request-list');
    for (let i = 0; i < dat.length; i += 1) {
      html += `<li>${dat[i]}<span class="request-btn"> <a class="btn btn-success" href="#"><i class="fa fa-check" aria-hidden="true"></i></a> <a class="btn btn-danger" href="#"><i class="fa fa-times" aria-hidden="true"></i></a> </span></li>`;
    }
    $requestList.html(html);
  });


  socket.on('message', (msg) => {
    chats.innerHTML += `<li class='left clearfix'><span class='chat-img pull-left'><img src='/images/U.png' alt='User Avatar' class='img-circle' /></span><div class='chat-body clearfix'><div class='header'><small class=' text-muted' id = '${message.time}'><span class='glyphicon glyphicon-time'></span><span class = 'time'>0</span><span class= 'timeunit'> mins</sapn> ago</small><strong class='pull-left primary-font'>${msg.username}</strong></div><p>${msg.message}</p></div></li>`;
  });


  socket.on('typing', (localUsername) => {
    typing.innerHTML = `${localUsername} is typing...`;
    setTimeout(() => { typing.innerHTML = ''; }, 5000);
  });

  // time Updation for chat
  setInterval(() => {
    const time = document.getElementsByClassName('time');
    const l = time.length;
    for (let i = 0; i < l; i += 1) {
      const c = time[i].innerHTML;
      time[i].innerHTML = (parseInt(c, 10) + 1);
    }
  }, 60000);
});
