// ----------------------------
// State
// ----------------------------

let playlist = [];
let deck = [];
let current = null;

let player = null;

let pendingStartTime = 0;
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
                rel: 0
            },

            events: {

                onReady: function() {

                    console.log(
                        "YouTube player ready"
                    );

                    playerReady = true;

                },


                onStateChange: function(event) {

                    const state =
                    event.data;


                    console.log(
                        "Player state:",
                        state
                    );


                    if(
                        state === YT.PlayerState.PLAYING
                    ){

                        console.log(
                            "Playback began at:",
                            player.getCurrentTime()
                        );


                        player.pauseVideo();

                    }

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
// Restore Saved Values
// ----------------------------

document.getElementById("playlistUrl").value =
localStorage.playlistUrl || "";


document.getElementById("apiKey").value =
localStorage.apiKey || "";



// ----------------------------
// Load Playlist
// ----------------------------

loadBtn.onclick = async function() {

    const playlistUrl =
    document.getElementById("playlistUrl").value;


    const apiKey =
    document.getElementById("apiKey").value;


    localStorage.playlistUrl =
    playlistUrl;


    localStorage.apiKey =
    apiKey;


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


    const cacheKey =
    "playlist_" + playlistId;


    const cached =
    localStorage.getItem(cacheKey);


    if(cached){

        playlist =
        JSON.parse(cached);

    }

    else {

        playlist =
        await getPlaylist(
            playlistId,
            apiKey
        );


        localStorage.setItem(
            cacheKey,
            JSON.stringify(playlist)
        );

    }


    if(
        playlist.length === 0
    ){

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

function shuffleDeck() {

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

async function nextSong() {


    document
    .getElementById("answer")
    .hidden = true;


    document
    .getElementById("blindCover")
    .style.display = "flex";


    guessInput.value = "";

    submitBtn.disabled = true;



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

        deck.unshift(current);

        return nextSong();

    }



    pendingStartTime =
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
        current.title,
        "Duration:",
        duration,
        "Start:",
        pendingStartTime
    );

    /*
        I intentionally use loadVideoById
        instead of cueVideoById.

        The player must actually initialize
        the media before seeking is reliable.
    */

    player.loadVideoById({
        current.id,
        startSeconds: pendingStartTime
    });



    document
    .getElementById("count")
    .textContent =
    `${playlist.length - deck.length} / ${playlist.length} played`;



    nextBtn.disabled = true;


}



// ----------------------------
// Duration Cache
// ----------------------------

async function getDuration(id) {


    const cacheKey =
    "duration_" + id;


    const cached =
    localStorage.getItem(cacheKey);


    if(cached){

        return Number(cached);

    }


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



    const duration =
    parseDuration(
        data.items[0]
        .contentDetails
        .duration
    );



    localStorage.setItem(
        cacheKey,
        duration
    );


    return duration;

}



// ----------------------------
// Parse YouTube Duration
// ----------------------------

function parseDuration(value) {


    const result =
    value.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );



    return (

        (result[1] || 0) * 3600

        +

        (result[2] || 0) * 60

        +

        (result[3] || 0)

    );

}
// ----------------------------
// Controls
// ----------------------------

playBtn.onclick = function() {

    if(!player){

        return;

    }


    player.playVideo();

};



pauseBtn.onclick = function() {

    if(!player){

        return;

    }


    player.pauseVideo();

};



showVideoBtn.onclick = function() {

    document
    .getElementById("blindCover")
    .style.display = "none";

};



// ----------------------------
// Guess Submission
// ----------------------------

guessInput.oninput = function() {

    submitBtn.disabled =
    guessInput.value.trim() === "";

};



submitBtn.onclick = function() {


    const guess =
    guessInput.value.trim();



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
    .getElementById("userGuess")
    .textContent =
    guess;



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
