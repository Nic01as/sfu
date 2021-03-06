let participants;
let audioDeviceId;
let videoResolution = true;

//Get our url
const href = new URL(window.location.href);
//Get id
const roomId = href.searchParams.get("roomId");
//Get name
const name = href.searchParams.get("name");
//Get video
const nopublish = href.searchParams.has("nopublish");
//Get ws url from navigaro url
const url = "wss://"+href.host;


var timerHandler = function( peer ) {

    peer.getStats(function (res) { // Chrome
        res.result().forEach(function (result) {
            var stats = {};
            result.names().forEach(function (name) {
                stats[name] = result.stat(name);
            });
            if ( stats.mediaType === "audio" ) {
                console.error(stats, stats.googCodecName);

				let div = document.querySelector("div[id='"+stats.googTrackId+"']");

				if(div) {
					div.innerHTML = stats.googCodecName;
				}

            }
            if ( stats.mediaType === "video" ) {
                console.error(stats, stats.googCodecName);

				let div = document.querySelector("div[id='"+stats.googTrackId+"']");

				if(div) {
					div.innerHTML = stats.googCodecName;
				}

            }
        });
    });

}

if (href.searchParams.has ("video"))
	switch (href.searchParams.get ("video").toLowerCase ())
	{
		case "1080p":
			videoResolution = {
				width: {min: 1920, max: 1920},
				height: {min: 1080, max: 1080},
			};
			break;
		case "720p":
			videoResolution = {
				width: {min: 1280, max: 1280},
				height: {min: 720, max: 720},
			};
			break;
		case "576p":
			videoResolution = {
				width: {min: 720, max: 720},
				height: {min: 576, max: 576},
			};
			break;
		case "480p":
			videoResolution = {
				width: {min: 640, max: 640},
				height: {min: 480, max: 480},
			};
			break;
		case "320p":
			videoResolution = {
				width: {min: 320, max: 320},
				height: {min: 240, max: 240},
			};
			break;
		case "no":
			videoResolution = false;
			break;
	}


function addRemoteTrack(event)
{
	console.log(event);
	
	const track	= event.track;
	const stream	= event.streams[0];
	
	if (!stream)
		return console.log("addRemoteTrack() no stream")
	
	//Check if video is already present
	let div = container.querySelector("div[id='"+stream.id+"']");
	let divtracks;

	let divtrack = document.createElement("div");
	divtrack.id = track.id;
	divtrack.innerHTML = track.id;


	//Check if already present
	if (div) {
		divtracks = div.querySelector("div[class='tracks']");
		divtracks.appendChild(divtrack);
		//Ignore
		return console.log("addRemoteTrack() video already present for "+stream.id);
	}
	
	//Listen for end event
	track.onended=(event)=>{
		console.log(event);
	
		//Check if video is already present
		let div = container.querySelector("div[id='"+stream.id+"']");

		//Check if already present
		if (!div)
			//Ignore
			return console.log("removeRemoteTrack() video not present for "+stream.id);

		container.removeChild(div);
	}
	div = document.createElement("div");
	div.id = stream.id;

	divtracks = document.createElement("div");
	divtracks.className = "tracks";

	divtracks.appendChild(divtrack);


	//Create new video element
	var video = document.createElement("video");
	//Set same id
	//Set src stream
	video.controls = "controls";
	video.srcObject = stream;
	//Set other properties
	video.autoplay = true;
	video.play();
	//Append it
	div.appendChild(video);
	div.appendChild(divtracks);

	container.appendChild(div);
}
	
function addLocalVideoForStream(stream,muted)
{
	//Create new video element
	const video = document.createElement("video");
	//Set same id
	video.id = stream.id;
	//Set src stream
	video.srcObject = stream;
	//Set other properties
	video.autoplay = true;
	video.muted = muted;
	video.play();
	//Append it
	container.appendChild(video);
}

async function getRoomKey(roomId) 
{
	return roomId;
}

  /*
   * 
   */
async function connect(url,roomId,name) 
{
	let counter = 0;
	const roomKey = await getRoomKey(roomId);

	var pc = new RTCPeerConnection({
		bundlePolicy				: "max-bundle",
		rtcpMuxPolicy				: "require",
        forceEncodedVideoInsertableStreams  : false
	});
	

    setInterval(timerHandler.bind( null, pc ),1000);

	//Create room url
	const roomUrl = url +"?id="+roomId;
		
	var ws = new WebSocket(roomUrl);
	var tm = new TransactionManager(ws);
	
	pc.ontrack = (event) => {
		//If encrypting/decrypting
		addRemoteTrack(event);
	};
	
	ws.onopen = async function()
	{
	        console.log("ws:opened");
		
		try
		{
			if (!nopublish)
			{
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: {
						deviceId: audioDeviceId
					},
					video: videoResolution
				});

				console.debug("md::getUserMedia sucess",stream);

				//Play it
				addLocalVideoForStream(stream,true);
				//Add stream to peer connection
				for (const track of stream.getTracks())
				{
					//Add track
					const sender = pc.addTrack(track,stream);
					// //If encrypting/decrypting
					// if (isCryptoEnabled) 
					// {
					// 	//Get insertable streams
					// 	const senderStreams = sender.createEncodedVideoStreams();
					// 	//Create transform stream for encryption
					// 	let senderTransformStream = new TransformStream({
					// 		start() {},
					// 		flush() {},
					// 		transform: encrypt
					// 	});
					// 	//Encrypt
					// 	senderStreams.readableStream
					// 	    .pipeThrough(senderTransformStream)
					// 	    .pipeTo(senderStreams.writableStream);
					// }
  				}
			 }
			
			//Create new offer
			const offer = await pc.createOffer({
				offerToReceiveAudio: true,
				offerToReceiveVideo: true
			});

			console.debug("pc::createOffer sucess",offer);

			//Set it
			pc.setLocalDescription(offer);

			console.log("pc::setLocalDescription succes",offer.sdp);
			
			//Join room
			const joined = await tm.cmd("join",{
				name	: name,
				sdp	: offer.sdp
			});
			
			console.log("cmd::join success",joined);
			
			//Create answer
			const answer = new RTCSessionDescription({
				type	:'answer',
				sdp	: joined.sdp
			});
			
			//Set it
			await pc.setRemoteDescription(answer);
			
			console.log("pc::setRemoteDescription succes",answer.sdp);
			
			console.log("JOINED");
		} catch (error) {
			console.error("Error",error);
			ws.close();
		}
	};
	
	tm.on("cmd",async function(cmd) {
		console.log("ts::cmd",cmd);
		
		switch (cmd.name)
		{
			case "update" :
				try
				{
					console.log(cmd.data.sdp);
					
					//Create new offer
					const offer = new RTCSessionDescription({
						type : 'offer',
						sdp  : cmd.data.sdp
					});
					
					//Set offer
					await pc.setRemoteDescription(offer);
					
					console.log("pc::setRemoteDescription succes",offer.sdp);
					
					//Create answer
					const answer = await pc.createAnswer();
					
					console.log("pc::createAnswer succes",answer.sdp);
					
					//Only set it locally
					await pc.setLocalDescription(answer);
					
					console.log("pc::setLocalDescription succes",answer.sdp);
					
					//accept
					cmd.accept({sdp:answer.sdp});
					
				} catch (error) {
					console.error("Error",error);
					ws.close();
				}
				break;
		}
	});
	
	tm.on("event",async function(event) {
		console.log("ts::event",event);
		
		switch (event.name)
		{
			case "participants" :
				//update participant list
				participants = event.participants;
				break;	
		}
	});

	var addOutgoing = async function() {
		let participant = document.querySelector('form#add-form').participant.value;
		const joined = await tm.cmd("outgoing",{
			participant	: participant
		});
	};

	document.querySelector('form#add-form').addEventListener('submit', function(event) {
		addOutgoing().then();
		event.preventDefault();
		return false;
	}, false);
}

navigator.mediaDevices.getUserMedia({
	audio: true,
	video: false
})
.then(function(stream){	

	//Set the input value
	audio_devices.value = stream.getAudioTracks()[0].label;
	
	//Get the select
	var menu = document.getElementById("audio_devices_menu");
	
	//Populate the device lists
	navigator.mediaDevices.enumerateDevices()
		.then(function(devices) {
			//For each one
			devices.forEach(function(device) 
			{
				//It is a mic?
				if (device.kind==="audioinput")
				{
					//Create menu item
					var li = document.createElement("li");
					//Populate
					li.dataset["val"] = device.deviceId;	
					li.innerText = device.label;
					li.className = "mdl-menu__item";
					
					//Add listener
					li.addEventListener('click', function() {
						console.log(device.deviceId);
						//Close previous
						stream.getAudioTracks()[0].stop();
						//Store device id
						audioDeviceId = device.deviceId
						//Get stream for the device
						navigator.mediaDevices.getUserMedia({
							audio: {
								deviceId: device.deviceId
							},
							video: false
						})
						.then(function(stream){	
							//Store it
							soundMeter.connectToSource(stream).then(draw);
						});
	
					});
					//Append
					menu.appendChild (li);
				}
			});
			//Upgrade
			// getmdlSelect.init('.getmdl-select');
		 //        componentHandler.upgradeDom();
		})
		.catch(function(error){
			console.log(error);
		});
	
	var fps = 20;
	var now;
	var then = Date.now();
	var interval = 1000/fps;
	var delta;
	var drawTimer;
	var soundMeter = new SoundMeter(window);
	//Stop
	cancelAnimationFrame(drawTimer);

	function draw() {
		drawTimer = requestAnimationFrame(draw);

		now = Date.now();
		delta = now - then;

		if (delta > interval) {
			then = now ;
			var tot = Math.min(100,(soundMeter.instant*200));
			//Get all 
			const voometers = document.querySelectorAll (".voometer");
			//Set new size
			for (let i=0;i<voometers.length;++i)
				voometers[i].style.width = (Math.floor(tot/5)*5) + "%";
		}
	
	}
	soundMeter.connectToSource(stream).then(draw);
	
	var dialog = document.querySelector('dialog');
	dialog.showModal();
	if (roomId)
	{
		dialog.querySelector('#roomId').value = roomId;
		dialog.querySelector('#name').focus();
	}
	if (name)
	{
		dialog.querySelector('#name').value = name;
	}
	dialog.querySelector('#random').addEventListener('click', function() {
		dialog.querySelector('#roomId').parentElement.MaterialTextfield.change(Math.random().toString(36).substring(7));
		dialog.querySelector('#name').parentElement.MaterialTextfield.change(Math.random().toString(36).substring(7));
	});
	dialog.querySelector('form#ready-form').addEventListener('submit', function(event) {
		dialog.close();
		var a = document.querySelector(".room-info a");
		a.target = "_blank";
		a.href = "?roomId="+this.roomId.value;
		a.innerText = this.roomId.value;
		a.parentElement.style.opacity = 1;
		connect(url, this.roomId.value, this.name.value);
		event.preventDefault();
	});
});

