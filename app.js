// ----------------------------
// State
// ----------------------------

let playlist = [];
let deck = [];
let current = null;

let player = null;
let playerReady = false;

let pendingStartTime = 0;
let hasSeeked = false;

const MIN_DURATION = 60;


// ----------------------------
// YouTube Player
// ----------------------------

function onYouTubeIframeAPIReady() {

    player = new YT.Player(
        "player",
        {
            height: "100%",
            width: "100%",

            playerVars: {
                controls: 0,
                modestbranding: 1,
                rel: 0
            },

            events: {

                onReady: function() {

                    console.log("YouTube player ready");

                    playerReady = true;

                },


                onStateChange: function(event) {

                    if(
                        event.data === YT.PlayerState.PLAYING
                    ){

                        console.log(
                            "Playing at:",
                            player.getCurrentTime()
                        );


                        if(!hasSeeked && pendingStartTime > 0){

                            hasSeeked = true;

                            console.log(
                                "Waiting before seek..."
                            );
                            
                            setTimeout(() => {
                                console.log(
                                    "Seeking to:",
                                    pendingStartTime
                                );
                                
                                player.seekTo(
                                    pendingStartTime,
                                    true
                                );
                            }, 1500);
                        }              
                    }
                }


// ----------------------------
// Elements
// ----------------------------

const loadBtn =
document.getElementById("loadBtn");

const playBtn =
document.getElementById("playBtn");

const pauseBtn =
document.getElementById("pauseBtn");

const showVideoBtn =
document.getElementById("showVideoBtn");

const submitBtn =
document.getElementById("submitBtn");

const nextBtn =
document.getElementById("nextBtn");

const guessInput =
document.getElementById("guessInput");

const status =
document.getElementById("status");


// ----------------------------
// Load Playlist
// ----------------------------

loadBtn.onclick = async function(){

    const url =
    document.getElementById("playlistUrl").value;

    const key =
    document.getElementById("apiKey").value;


    const playlistId =
    new URL(url)
    .searchParams
    .get("list");


    if(!playlistId){

        status.textContent =
        "Invalid playlist";

        return;

    }


    status.textContent =
    "Loading...";


    playlist =
    await getPlaylist(
        playlistId,
        key
    );


    if(!playlist.length){

        status.textContent =
        "No songs found";

        return;

    }


    shuffleDeck();


    document.getElementById("setup").hidden=true;
    document.getElementById("game").hidden=false;


    status.textContent =
    `${playlist.length} songs loaded`;


    nextSong();

};


// ----------------------------
// Get Playlist
// ----------------------------

async function getPlaylist(id,key){

    let results=[];
    let token="";


    do{

        const response =
        await fetch(
            "https://www.googleapis.com/youtube/v3/playlistItems" +
            "?part=snippet" +
            "&maxResults=50" +
            `&playlistId=${id}` +
            `&key=${key}` +
            `&pageToken=${token}`
        );


        const data =
        await response.json();


        data.items.forEach(item=>{

            results.push({

                id:
                item.snippet.resourceId.videoId,

                title:
                item.snippet.title,

                channel:
                item.snippet.videoOwnerChannelTitle

            });

        });


        token =
        data.nextPageToken || "";


    }
    while(token);


    return results;

}


// ----------------------------
// Shuffle
// ----------------------------

function shuffleDeck(){

    deck=[...playlist];


    for(
        let i=deck.length-1;
        i>0;
        i--
    ){

        const j =
        Math.floor(
            Math.random()*(i+1)
        );


        [
            deck[i],
            deck[j]
        ] =
        [
            deck[j],
            deck[i]
        ];

    }

}


// ----------------------------
// Next Song
// ----------------------------

async function nextSong(){

    document.getElementById("answer").hidden=true;

    document.getElementById("blindCover")
    .style.display="flex";


    guessInput.value="";

    submitBtn.disabled=true;


    if(deck.length===0){

        shuffleDeck();

    }


    current =
    deck.pop();


    const duration =
    await getDuration(current.id);


    if(duration < MIN_DURATION){

        return nextSong();

    }


    pendingStartTime =
    Math.floor(
        duration * .2 +
        Math.random() *
        duration * .6
    );


    hasSeeked=false;


    console.log(
        "Selected:",
        current.title
    );

    console.log(
        "Start:",
        pendingStartTime
    );


    player.loadVideoById(
        current.id
    );


    nextBtn.disabled=true;

}


// ----------------------------
// Duration
// ----------------------------

async function getDuration(id){

    const key =
    document.getElementById("apiKey").value;


    const response =
    await fetch(
        "https://www.googleapis.com/youtube/v3/videos" +
        "?part=contentDetails" +
        `&id=${id}` +
        `&key=${key}`
    );


    const data =
    await response.json();


    return parseDuration(
        data.items[0]
        .contentDetails
        .duration
    );

}


function parseDuration(value){

    const match =
    value.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );


    return (
        (match[1]||0)*3600 +
        (match[2]||0)*60 +
        (match[3]||0)
    );

}


// ----------------------------
// Buttons
// ----------------------------

playBtn.onclick=function(){

    player.playVideo();

};


pauseBtn.onclick=function(){

    player.pauseVideo();

};


showVideoBtn.onclick=function(){

    document.getElementById("blindCover")
    .style.display="none";

};


guessInput.oninput=function(){

    submitBtn.disabled =
    guessInput.value.trim()==="";

};


submitBtn.onclick=function(){

    document.getElementById("blindCover")
    .style.display="none";


    document.getElementById("title")
    .textContent=current.title;


    document.getElementById("channel")
    .textContent=current.channel;


    document.getElementById("userGuess")
    .textContent=
    guessInput.value;


    document.getElementById("answer")
    .hidden=false;


    nextBtn.disabled=false;

};


nextBtn.onclick =
nextSong;
