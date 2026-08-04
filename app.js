let playlist = [];
let deck = [];
let current = null;

let player;

let revealed = false;


const MIN_DURATION = 60;


// YouTube player initialization

function onYouTubeIframeAPIReady() {

    player = new YT.Player(
        "player",
        {
            height:"100%",
            width:"100%",
            playerVars:{
                controls:1,
                modestbranding:1,
                rel:0
            }
        }
    );

}


// Elements

const loadBtn = document.getElementById("loadBtn");
const playBtn = document.getElementById("playBtn");
const revealBtn = document.getElementById("revealBtn");
const nextBtn = document.getElementById("nextBtn");

const status = document.getElementById("status");


// Load playlist

loadBtn.onclick = async () => {


    const url =
        document.getElementById("playlistUrl").value;

    const key =
        document.getElementById("apiKey").value;


    localStorage.playlistUrl=url;
    localStorage.apiKey=key;


    const id =
        new URL(url).searchParams.get("list");


    if(!id){

        status.textContent="Invalid playlist URL";
        return;

    }


    status.textContent="Loading...";


    playlist =
        await getPlaylist(id,key);


    if(!playlist.length){

        status.textContent="No playable videos found";
        return;

    }


    shuffleDeck();


    document.getElementById("setup").hidden=true;
    document.getElementById("game").hidden=false;


    status.textContent="";


    nextSong();

};



// YouTube API fetch

async function getPlaylist(id,key){


    let videos=[];

    let token="";


    do {


        let url =
        `https://www.googleapis.com/youtube/v3/playlistItems`
        +
        `?part=snippet`
        +
        `&maxResults=50`
        +
        `&playlistId=${id}`
        +
        `&key=${key}`
        +
        `&pageToken=${token}`;


        let res =
            await fetch(url);


        let data =
            await res.json();



        if(data.error){

            alert(data.error.message);
            return [];

        }



        data.items.forEach(item=>{

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



// Shuffle deck

function shuffleDeck(){

    deck =
    [...playlist];

    for(let i=deck.length-1;i>0;i--){

        let j =
        Math.floor(Math.random()*(i+1));

        [deck[i],deck[j]] =
        [deck[j],deck[i]];

    }

}



// Pick next song

async function nextSong(){


    revealed=false;

    document.getElementById("answer").hidden=true;

    document.getElementById("blindCover").style.display="flex";


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


    const start =
        Math.floor(
            duration*0.2 +
            Math.random()*
            (duration*0.6)
        );


    player.loadVideoById({

        videoId:current.id,

        startSeconds:start

    });


    document.getElementById("count").textContent =
    `${playlist.length-deck.length} / ${playlist.length} played`;



    nextBtn.disabled=true;

}



// Get video duration

async function getDuration(id){


    const key =
    document.getElementById("apiKey").value;


    const url =
    `https://www.googleapis.com/youtube/v3/videos`
    +
    `?part=contentDetails`
    +
    `&id=${id}`
    +
    `&key=${key}`;


    const res =
        await fetch(url);


    const data =
        await res.json();


    const iso =
        data.items[0]
        .contentDetails
        .duration;


    return parseISO8601(iso);


}



function parseISO8601(duration){

    let match =
    duration.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );


    return (
        (match[1]||0)*3600+
        (match[2]||0)*60+
        (match[3]||0)*1
    );

}



// Controls

playBtn.onclick=()=>{

    document
    .getElementById("blindCover")
    .style.display="none";


    player.playVideo();

};



revealBtn.onclick=()=>{


    revealed=true;


    document.getElementById("title").textContent =
        current.title;


    document.getElementById("channel").textContent =
        current.channel;


    document.getElementById("answer").hidden=false;


    nextBtn.disabled=false;


};



nextBtn.onclick=nextSong;



// Restore fields

document.getElementById("playlistUrl").value =
localStorage.playlistUrl || "";


document.getElementById("apiKey").value =
localStorage.apiKey || "";
