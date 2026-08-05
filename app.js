let apiKey = "";
let playlistId = "";

let videos = [];
let currentVideo = null;

let player;
let playerReady = false;

let currentStartTime = 0;

// YouTube iframe API callback
function onYouTubeIframeAPIReady() {
playerReady = true;
}

// Extract playlist ID from URL
function extractPlaylistId(url) {

```
const match = url.match(/[?&]list=([^&]+)/);

if (!match) {
    alert("Could not find playlist ID.");
    return null;
}

return match[1];
```

}

// Start game setup
async function initializeGame() {

```
apiKey = document.getElementById("apiKey").value.trim();

playlistId =
    extractPlaylistId(
        document.getElementById("playlistUrl").value.trim()
    );

if (!apiKey || !playlistId) {
    return;
}


videos = await loadPlaylistVideos();


if (videos.length === 0) {
    alert("No videos found.");
    return;
}


document.getElementById("setup").style.display = "none";
document.getElementById("game").style.display = "block";


startRound();
```

}

// Load playlist entries
async function loadPlaylistVideos() {

```
let results = [];

let nextPage = "";


do {

    let url =
        "https://www.googleapis.com/youtube/v3/playlistItems" +
        "?part=snippet" +
        "&maxResults=50" +
        "&playlistId=" + playlistId +
        "&key=" + apiKey +
        (nextPage ? "&pageToken=" + nextPage : "");


    const response = await fetch(url);

    const data = await response.json();


    if (data.error) {
        alert(data.error.message);
        return [];
    }


    for (const item of data.items) {

        results.push({
            id: item.snippet.resourceId.videoId,
            title: item.snippet.title
        });

    }


    nextPage = data.nextPageToken || "";


} while (nextPage);


return results;
```

}

// Begin a new round
async function startRound() {

```
document.getElementById("answer").innerHTML = "";
document.getElementById("guess").value = "";

document.getElementById("video-cover").style.display = "block";


currentVideo =
    videos[
        Math.floor(Math.random() * videos.length)
    ];


const duration =
    await getVideoDuration(currentVideo.id);


currentStartTime =
    Math.floor(
        duration * (0.1 + Math.random() * 0.8)
    );


loadVideo(
    currentVideo.id,
    currentStartTime
);
```

}

// Get video duration
async function getVideoDuration(videoId) {

```
const url =
    "https://www.googleapis.com/youtube/v3/videos" +
    "?part=contentDetails" +
    "&id=" + videoId +
    "&key=" + apiKey;


const response = await fetch(url);
const data = await response.json();


const duration =
    data.items[0]
    .contentDetails
    .duration;


return parseDuration(duration);
```

}

// Convert ISO duration to seconds
function parseDuration(duration) {

```
const match =
    duration.match(
        /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/
    );


const hours =
    parseInt(match[1] || 0);

const minutes =
    parseInt(match[2] || 0);

const seconds =
    parseInt(match[3] || 0);


return hours * 3600 +
       minutes * 60 +
       seconds;
```

}

// Load YouTube player
function loadVideo(videoId, startTime) {

```
if (player) {

    player.loadVideoById({
        videoId: videoId,
        startSeconds: startTime
    });

    return;
}


player =
    new YT.Player(
        "player",
        {
            videoId: videoId,

            playerVars: {
                autoplay: 1,
                controls: 0
            },

            events: {

                onReady: function(event) {

                    event.target.seekTo(startTime);
                    event.target.playVideo();

                }

            }

        }
    );
```

}

// Play/pause button
function toggleAudio() {

```
if (!player) {
    return;
}


const state =
    player.getPlayerState();


if (
    state === YT.PlayerState.PLAYING
) {

    player.pauseVideo();

} else {

    player.playVideo();

}
```

}

// Reveal answer
function revealAnswer() {

```
document.getElementById("answer")
    .innerHTML =
    currentVideo.title;


document.getElementById("video-cover")
    .style.display = "none";
```

}

// Next song
function nextSong() {

```
if (player) {
    player.stopVideo();
}

startRound();
```

}
