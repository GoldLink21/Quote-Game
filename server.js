
const { readFileSync, writeFileSync } = require("fs");
const express = require("express");
const util = require("./util");
const app = express();
app.use(express.urlencoded({extended:true}));
app.use(express.json());

//Setup for server client communication
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

/**@type {{quotes:[{dialogue:[{person:string[],quote:string}]}],people:[string]}} */
const quotesFileContents = JSON.parse(readFileSync("./quotes.json", 'utf-8'));
const quotes = quotesFileContents.quotes;

var ip = Object.values(require('os').networkInterfaces()).reduce((r, list) => r.concat(list.reduce((rr, i) => rr.concat(i.family==='IPv4' && !i.internal && i.address || []), [])), [])[0];


/**Use to get updated css and client functions */
function getHeadText(){
    return  `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        ${util.fileToHTML("style.css","style")}
        <script src="/socket.io/socket.io.js"></script>
        <script>
            const isHost = false;
            var socket = io();
        </script>
        ${util.fileToHTML("clientFunctions.js","script")}
        <title>Blub Quote Guessing Game</title>
    </head>
    <body>`
}

const headText = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    ${util.fileToHTML("style.css","style")}
    <script src="/socket.io/socket.io.js"></script>
    <script>
        const isHost = false;
        var socket = io();
    </script>
    ${util.fileToHTML("clientFunctions.js","script", "defer")}
    <title>Blub Quote Guessing Game</title>
</head>
<body>`;

/**Gives the HTML for the form with the div to insert into */
function getFormText(user=''){
    return `
    <form autocomplete='off' method='post' onkeydown="return event.key!='Enter';">
        <input type='text' name='user' id='user' value="${user}" ${(user!='')?"readonly":""} placeholder="Who are you?">
        <div id="formHere"></div>
    </form>
    `
}

//When a client connects to the main page
app.get('/',(req,res)=>{
    res.send(getHeadText()+` 
    <h1>Welcome</h1>
    <div class="intro-slider">Please Enter a name in the "Who are you?" spot</div>
    ${getFormText()}
    ${(currentQuote != undefined)?"<script defer>updateForm("+util.countPeopleInDialogue(currentQuote)+")</script>":""}
    <!--Used to prevent form resubmision -->
    <script>
    if ( window.history.replaceState ) {
        window.history.replaceState( null, null, window.location.href );
    }
    </script>
    </body></html>`);
});

/*
io.on("connection",(socket)=>{
    //console.log("user connected!");
    //logOnClient("Woah I heard you!");
    socket.on('disconnect',()=>{
        //console.log("user disconnected!");
    })
})
*/

//Anytime a client sends data
app.post("/",(req,res)=>{
    var params = req.body;
    var voteSuccess = util.addToVotes(params);
    var sendVoted = false;
    var out = " <span id='voted'";
    //Error checking 
    if(voteSuccess == 1){
        out+=">You voted for <b>"+util.parseInputs(params)+"</b></span>";
        io.emit("getVote",params.user);
    } else if(voteSuccess == -1){
        out+=" style='color:red'>Please enter a username for your vote to be counted</span>"
    } else if(voteSuccess == -2){
        out+=" style='color:red'>Please select a vote for all possible people</span>"
    } else if(voteSuccess == -3){
        out+=" style='color:red'>Please don't vote for the same person mutiple times</span>"
    }
    res.send(getHeadText()+`
    <h1>Welcome</h1>
    ${out}
    ${getFormText(params.user)}
    ${(voteSuccess > 0)?"":"<script>updateForm("+util.countPeopleInDialogue(currentQuote)+", false)</script>"}
    </body></html>`);
});

//The IP address will not be correct when on different wifi
let port=5000;
server.listen(port, ()=>console.log('http://localhost:'+port+"\thttp://"+ip+":"+port+"/host"));




//Head text but sets the isHost const to true
const hostHead = headText.replace("isHost = false",'isHost = true');
//Inital host connection handling
const hostBody =`
<div id='bodytext'>
<h1 class='rainbow-text'>The Great Blub Quote Guessing Game</h1>
<p>I have (almost manually) compiled ${quotes.length} quotes into a file to make a fun game for everyone to enjoy! Tell me how it is after please!</p>
<form autocomplete="off" method="post">
    <input type='text' id='hidden' name='hidden'>
    ${hostButton("Random-Quote",'randQuote')}
    ${hostButton("Game-Start","gameStart")}
    <input type='submit' id='submit' class='hidden'>
</form>
` 

const hostText = hostHead+`<div id='bodytext'>`+hostBody+"</div>";

function getHostText(){
    return getHeadText().replace("isHost = false", "isHost = true") + hostBody;
}

/**
 * @returns the HTML for an input type=button that auto sends a value to the server
 * @param {string} data A dash delimeted string for the data type
 */
function hostButton(data,funcStr){
    return `<input type='button' onclick='hostSendDataButton("${funcStr}")' name='${data}' id='${data}' value='${data.replace("-"," ")}'>`
}



//Host connection
app.get("/host",(req,res)=>{
    res.send(getHostText() + `<br><p>Connect at ${ip}:${port}</p>`);
});


/**@type {quotes[0]} */
var currentQuote;

//When the host sends data
app.post("/host",(req,res)=>{
    /**Extra part on page to add */
    var extra = '';
    /**Tracks what page to send in response */
    var mode = 'none';
    switch(req.body.hidden){
        case 'randQuote':
            //Generate a random quote just for viewing
            var q = quotes[util.randInt(quotes.length)].dialogue;
            currentQuote = q;
            extra = util.tag(util.parseDialogue(q), "p");
            writeFileSync("./data/currentQuote.json",JSON.stringify(q));
            break;
        case "tallyQuotes":
            //Tallies the scores for the current quote
            extra = tallyQuotes();
            mode = 'tally';
            break;
        case "gameStart":
            //Ran on initial new game start
            util.resetVotes();
            util.resetScores();
            currentGameQuotes = util.getShuffledQuotes();
            mode = 'game';
            extra = handleGameQuote(req,res);
            break;
        case "nextQuote":
            //Getting the next quote for the current game
            mode = 'game';
            extra = handleGameQuote(req,res);
            if(extra == false){
                mode = 'end';
                extra = "";
            }
            break;
        case "gameEnd":
            //Allow for premature end
            mode = 'end';
            break;
    }
    if(currentGameQuotes == undefined) {
        //Handles general cases
        res.send(
            `<h1 class='rainbow-text'>The Great Blub Quote Guessing Game</h1>
            <form autocomplete="off" method="post">
                <input type='text' id='hidden' name='hidden'>
                ${hostButton("Random-Quote",'randQuote')}
                ${hostButton("Game-Start","gameStart")}
                <input type='submit' id='submit' class='hidden'>
            </form>
            <p>${extra}</p>`);
    } else {
        //When in a game
        if(mode == 'tally'){
            res.send(`
            ${extra}
            <form autocomplete="off" method="post">
                <input type='text' id='hidden' name='hidden'>
                ${hostButton("Next-Quote","nextQuote")}
                <input type='button' onclick='endGameButton()' name='End-Game' id='End-Game' value='End Game'>
                <input type='submit' id='submit' class='hidden'>
            </form>
            `)
        } else if(mode == 'game'){
            res.send(`
            ${extra}
            <form autocomplete="off" method="post">
                <input type='text' id='hidden' name='hidden'>
                ${hostButton("Tally-Quotes","tallyQuotes")}
                <input type='submit' id='submit' class='hidden'>
            </form>
            <div id='voters'>Votes in from:</div>
            `)
        } else if(mode == 'end'){
            //Setup for end screen
            currentGameQuotes = undefined;
            var winners = util.getWinners();
            io.emit("game-end", winners);
            var finalScoreText = '';
            var sorted = Object.entries(winners.scores).sort((a,b)=>b[1] - a[1]);
            sorted.forEach(e=>{
                finalScoreText+=`<span ${winners.winners.includes(e[0])?"class = 'rainbow-text'>":">"}${e[0]}: ${e[1]}</span><br>`
            })
            console.log("End Game!")
            res.send(`
                <p>That's the end of the game!</p>
                <p>I hope you all had a fun time!</p>
                <p>The final scores were:</p>
                <p>${finalScoreText}</p>
            `);
        }
        
    }
});
var currentGameQuotes;

/**Prepares all quote handling for the next quote in the queue */
function handleGameQuote(req,res){
    //Not in game so ignore
    if(currentGameQuotes == undefined || currentGameQuotes.length == 0){
        return false;
    }
    var q = currentGameQuotes.pop().dialogue;
    currentQuote = q;
    var out = {quote:q,people:{}}
    //Keep track of number of people
    var count = 0;
    var outputPeople = []
    for(let i=0;i<q.length;i++) {
        //See if there is that person accounted for already
        //Multiple people can be stored in the person variable so we need to track that
        for(let j = 0;j<q[i].person.length;j++) {
            let currentName = q[i].person[j];
            outputPeople.push(currentName);
            if(!Object.values(out.people).includes(currentName)) {
                //If not defined set as a name from A onward using charcode
                out.people[String.fromCharCode('A'.charCodeAt(0) + (count++))] = currentName;
            }
            //Set the person to be displayed as the correct person from the out display
            for(key in out.people) {
                if(out.people[key] == currentName) {
                    q[i].person[j] = key;
                    break;
                }
            }
        }
    }
    console.log("Correct: "+util.putIntoEnglishList(outputPeople));
    writeFileSync("./data/currentQuote.json",JSON.stringify(out));
    io.emit("new-quote",Object.keys(out.people));
    return `<div class='quote'>${util.parseDialogue(q)}</div>`;
    //return util.tag(util.parseDialogue(q), "p");
}

/**Checks the votes and increments the scores for those people */
function tallyQuotes(){
    var votes = JSON.parse(readFileSync("./data/votes.json"));
    var scores = JSON.parse(readFileSync("./data/playerScores.json"));
    if(Object.keys(votes).length == 0){
        return "Wait to tally votes till there are some votes in, geez".fontcolor("red");
    }
    var correct = util.putIntoEnglishList(...Object.values(JSON.parse(readFileSync("./data/currentQuote.json")).people));
    var counts = {};
    var totalVotes=0;
    var winners = [];
    for(person in votes){
        //console.log(person + " voted for " + votes[person]);
        totalVotes++;
        //Add people to the scorelist if they haven't been
        if(!(person in scores)){
            scores[person]=0;
        }
        //Initialize for counting votes
        if(!(votes[person] in counts)){
            counts[votes[person]] = 0;
        }
        counts[votes[person]]++;
        if(votes[person] == correct){
            winners.push(person);
            scores[person]++;
        }
    }
    //console.log(JSON.stringify(counts));
    var voteText = "Vote totals were:";
    for(key in counts){
        //console.log(key+" "+counts[key]);
        voteText+=`<br>${key}: ${counts[key]}/${totalVotes} = ${Math.round((counts[key]/totalVotes)*100000)/1000}%`
    }
    writeFileSync("./data/playerScores.json",JSON.stringify(scores));
    util.resetVotes();
    currentQuote = undefined;
    util.resetCurrentQuote();
    io.emit("tallyQuotes")
    return `
    The Correct Answer was ${correct}!<br>${voteText}<br>The people who guessed correctly were:
    ${(winners.length == 0)?"No one! You all guessed wrong!":"<div class='rainbow-text'>"+winners.join("<br>")+"</div>"}`
}
//Allows the users to request the people for the quotes without getting the quotes themselves and cheating
app.get("/quotesPeople.json",(req,res)=>{
    res.send((JSON.parse(readFileSync("quotes.json")).people));
});

function logOnClient(data){
    io.emit("log",JSON.stringify(data));
}

var list = [
    ["/music.wav","music/music.wav"],
    ["/transition.wav","music/transition.wav"],
    ["/vote.wav","sfx/vote.wav"],
    ["/favicon.ico","./favicon.ico"],
    ["/music2.wav","music/music2.wav"],
    ["/mellow.wav","music/mellow-old.wav"]
];

list.forEach(s=>{
    app.get(s[0],(req,res)=>{
        res.download(s[1]);
    })
})
/*
app.get("/music.wav",(req,res)=>{
    res.download("music/music.wav");
});
app.get("/transition.wav",(req,res)=>{
    res.download("music/transition.wav");
});
app.get("/vote.wav",(req,res)=>{
    res.download("sfx/vote.wav");
});

app.get("/favicon.ico",(req,res)=>{
    res.download("./favicon.ico");
});
*/