let playlist = [];
let deck = [];
let current = null;

let player;


const MIN_DURATION = 60;



// YouTube player

function onYouTubeIframeAPIReady() {


    player = new YT.Player(
        "player",
        {

            height:"100%",
            width:"100%",

            playerVars:{

                controls:0,
                modestbranding:1,
                rel:0

            }

        }
    );

}



// Elements

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




// Restore saved fields

document.getElementById("playlistUrl").value =
localStorage.playlistUrl || "";


document.getElementById("apiKey").value =
localStorage.apiKey || "";




// Load playlist

loadBtn.onclick = async function(){


const playlistUrl =
document.getElementById("playlistUrl").value;


const apiKey =
document.getElementById("apiKey").value;


localStorage.playlistUrl = playlistUrl;

localStorage.apiKey = apiKey;



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
"No playlist ID found";

return;

}



status.textContent =
"Loading playlist...";



playlist =
await getPlaylist(
playlistId,
apiKey
);



if(playlist.length===0){

status.textContent =
"No videos found";

return;

}



shuffleDeck();



document.getElementById("setup").hidden=true;

document.getElementById("game").hidden=false;



status.textContent =
`${playlist.length} songs loaded`;



nextSong();



};






// Fetch playlist

async function getPlaylist(id,key){


let videos=[];

let token="";



do{


let url =
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



let response =
await fetch(url);


let data =
await response.json();



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


deck=[...playlist];



for(
let i=deck.length-1;
i>0;
i--
){


let j =
Math.floor(
Math.random()*(i+1)
);



[
deck[i],
deck[j]
]
=
[
deck[j],
deck[i]
];


}


}




// Next song

async function nextSong(){


document.getElementById("answer").hidden=true;


document.getElementById("blindCover").style.display="flex";


guessInput.value="";

submitBtn.disabled=true;


if(deck.length===0){

shuffleDeck();

}



current =
deck.pop();



let duration =
await getDuration(current.id);



if(duration < MIN_DURATION){

return nextSong();

}



let start =
Math.floor(

duration*0.2
+
Math.random()*
(duration*0.6)

);



player.loadVideoById({

videoId:
current.id,

startSeconds:
start

});



document.getElementById("count").textContent =
`${playlist.length-deck.length} / ${playlist.length} played`;



nextBtn.disabled=true;


}






// Duration lookup

async function getDuration(id){


let key =
document.getElementById("apiKey").value;



let url =
"https://www.googleapis.com/youtube/v3/videos"
+
"?part=contentDetails"
+
`&id=${id}`
+
`&key=${key}`;



let response =
await fetch(url);


let data =
await response.json();



return parseDuration(
data.items[0]
.contentDetails
.duration
);


}




function parseDuration(value){


let result =
value.match(
/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
);



return (

(result[1]||0)*3600
+
(result[2]||0)*60
+
(result[3]||0)

);


}






// Audio controls

playBtn.onclick=function(){

player.playVideo();

};



pauseBtn.onclick=function(){

player.pauseVideo();

};






// Reveal video

showVideoBtn.onclick=function(){


document.getElementById("blindCover")
.style.display="none";


};






// Guess box

guessInput.oninput=function(){


submitBtn.disabled =
guessInput.value.trim()==="";


};






// Submit answer

submitBtn.onclick=function(){


let guess =
guessInput.value.trim();



document.getElementById("blindCover")
.style.display="none";



document.getElementById("title")
.textContent =
current.title;



document.getElementById("channel")
.textContent =
current.channel;



document.getElementById("userGuess")
.textContent =
guess;



document.getElementById("answer")
.hidden=false;



nextBtn.disabled=false;


};






// Next button

nextBtn.onclick =
nextSong;
