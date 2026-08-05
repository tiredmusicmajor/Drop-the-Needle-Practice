// ----------------------------
// State
// ----------------------------

let playlist = [];
let deck = [];
let current = null;

let player = null;
let playerReady = false;

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
                rel: 0,
                enablejsapi: 1
            },

            events: {

                onReady: function() {

                    console.log(
                        "YouTube player ready"
                    );

                    playerReady = true;

                },

                onStateChange: function(event) {

                    console.log(
                        "Player state:",
                        event.data
                    );

                }

            }
        }
    );

}


// ----------------------------
// Elements
// ----------------------------

const loadBtn =
document.getElementById("loadBtn");

const nextBtn =
document.getElementById("nextBtn");

const status =
document.getElementById("status");

const guessInput =
document.getElementById("guessInput");

const submitBtn =
document.getElementById("submitBtn");


// ----------------------------
// Load Playlist
// ----------------------------

loadBtn.onclick = async function() {

    const playlistUrl =
    document.getElementById("playlistUrl").value;


    const apiKey =
    document.getElementById("apiKey").value;


    let playlistId;


    try {

        playlistId =
        new URL(playlistUrl)
        .searchParams
        .get("list");

    }

    catch {

        status.textContent =
        "Invalid playlist URL";

        return;

    }


    if(!playlistId){

        status.textContent =
        "Playlist ID not found";

        return;

    }


    status.textContent =
    "Loading playlist...";


    playlist =
    await getPlaylist(
        playlistId,
        apiKey
    );


    if(playlist.length === 0){

        status.textContent =
        "No videos found";

        return;

    }


    shuffleDeck();


    document
    .getElementById("setup")
    .hidden = true;


    document
    .getElementById("game")
    .hidden = false;


    status.textContent =
    `${playlist.length} songs loaded`;


    nextSong();

};


// ----------------------------
// Get Playlist
// ----------------------------

async function getPlaylist(id, key) {

    let videos = [];

    let token = "";


    do {

        const url =
        "https://www.googleapis.com/youtube/v3/playlistItems"
        +
        "?part=snippet"
        +
        "&maxResults=50"
        +
        `&playlistId=${id}`
        +
        `&key=${key}`
        +
        `&pageToken=${token}`;


        const response =
        await fetch(url);


        const data =
        await response.json();


        if(data.error){

            alert(
                data.error.message
            );

            return [];

        }


        data.items.forEach(item => {

            videos.push({

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


    return videos;

}


// ----------------------------
// Shuffle
// ----------------------------

function shuffleDeck(){

    deck =
    [...playlist];


    for(
        let i = deck.length - 1;
        i > 0;
        i--
    ){

        const j =
        Math.floor(
            Math.random() * (i + 1)
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

    if(!playerReady){

        console.log(
            "Player not ready"
        );

        return;

    }


    document
    .getElementById("blindCover")
    .style.display = "flex";


    document
    .getElementById("answer")
    .hidden = true;


    if(deck.length === 0){

        shuffleDeck();

    }


    current =
    deck.pop();


    const duration =
    await getDuration(
        current.id
    );


    if(duration < MIN_DURATION){

        return nextSong();

    }


    const startTime =
    Math.floor(
        duration * 0.2
        +
        Math.random()
        *
        (
            duration * 0.6
        )
    );


    console.log(
        "Selected:",
        current.title
    );

    console.log(
        "Duration:",
        duration
    );

    console.log(
        "Starting at:",
        startTime
    );


    player.cueVideoById({

        videoId:
        current.id,

        startSeconds:
        startTime

    });


    setTimeout(() => {

        player.playVideo();

    }, 500);


    nextBtn.disabled = true;

}


// ----------------------------
// Duration
// ----------------------------

async function getDuration(id){

    const key =
    document
    .getElementById("apiKey")
    .value;


    const url =
    "https://www.googleapis.com/youtube/v3/videos"
    +
    "?part=contentDetails"
    +
    `&id=${id}`
    +
    `&key=${key}`;


    const response =
    await fetch(url);


    const data =
    await response.json();


    return parseDuration(
        data.items[0]
        .contentDetails
        .duration
    );

}


// ----------------------------
// Parse Duration
// ----------------------------

function parseDuration(value){

    const result =
    value.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );


    return (

        (Number(result[1]) || 0) * 3600

        +

        (Number(result[2]) || 0) * 60

        +

        (Number(result[3]) || 0)

    );

}


// ----------------------------
// Answer
// ----------------------------

submitBtn.onclick = function(){

    document
    .getElementById("blindCover")
    .style.display = "none";


    document
    .getElementById("title")
    .textContent =
    current.title;


    document
    .getElementById("channel")
    .textContent =
    current.channel;


    document
    .getElementById("answer")
    .hidden = false;


    nextBtn.disabled = false;

};


// ----------------------------
// Next Button
// ----------------------------

nextBtn.onclick =
nextSong;
