/**Shortcut to allow buttons to just send a value to the server on click */
function hostSendDataButton(value){
    // document.getElementById("hidden").value = value;
    // document.getElementById("submit").click();
    var xhttp = new XMLHttpRequest();
    //var data = new FormData();
    //data.append("data",JSON.stringify(value));
    var send = {hidden:value};

    xhttp.onreadystatechange = function(){
        if(this.readyState == 4 && this.status == 200){
            //Completion
            getBody().innerHTML = xhttp.responseText;
        }
    }
    xhttp.open("POST","/host",false);
    xhttp.setRequestHeader("Content-type","application/json");
    xhttp.send(JSON.stringify(send));
}
function getBody(){
    return document.getElementById("bodytext");
}

/**Retrieve file from server without refresh */
function getFileContents(url,callback) {
    var xhttp = new XMLHttpRequest();
    xhttp.onreadystatechange = function() {
        if (this.readyState == 4 && this.status == 200) {
            callback(this.responseText);
        }
    };
    xhttp.open("GET", url, false);
    xhttp.send();
}
/**Stores the people for creating the form */
var people=[];
getFileContents("/quotesPeople.json",res=>people = JSON.parse(res));

/**Makes the form inputs */
function selectOneInput(type='radio', count=1){
    var out = '';
    for(let i=0;i<count;i++){
        out+=`<span class="divided centered">${String.fromCharCode("A".charCodeAt(0)+i)}</span>`
    }
    out+="<br>"
    people.forEach(p=>{
        for(let i=0;i<count;i++){
            out+='<span class="divided">'
            out += `<input type='${type}' name="people${i+1}" id="${p}${i+1}" value=${p}><label for=${p}${i+1}>${p}</label></span>`
        }
        out+="<br>"
    });
    return out;
}
//Immediately invoked
(function setupListener(){
    socket.on("new-quote",
    /**@param {string[]} msg The people who are part of the new quote! */
    function(msg){
        //When a new quote is recieved, need to update the form
        if(!isHost){
            updateForm(msg.length);
        } else {
            crossFade(music.main,music.main2);
        }
        
    });
    socket.on("getVote",vote=>{
        if(isHost){
            ///Play Sound
            playAudio("vote.wav");
            console.log("Vote!")
            document.getElementById("voters").innerHTML += "<br>" + vote;
        }
    })
    //Something to help with testing
    socket.on("log",data=>{
        console.log(JSON.parse(data));
    });
    //Removes the ability to cast votes after the votes have been tallied
    socket.on("tallyQuotes",()=>{
        var fh = document.getElementById("formHere");
        if(fh != undefined)
            fh.innerHTML="";
        /////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        if(isHost){
            fadeAudioOut(music.main2, 0.1,20);
            playAfter(music.transition, music.main);
        }
    })
    //Gives a great page for when the game ends
    socket.on("game-end",
    /**@param {{winners:string[],scores:{[key]:number}[]}} endScores */
    function(endScores) {
        if(!isHost){
            var cur = document.getElementById("user").value;
            if(endScores.winners.includes(cur)){
                //You Win!
                document.body.innerHTML = `<h1 class = 'rainbow-text'>You won ${cur}!! Congrats!</h1>`
            } else {
                //Not Quite
                document.body.innerHTML = `<h1>Good effort ${cur}! You'll get it next time!</h1>`
            }
            document.body.innerHTML += `<p>Your final score was ${endScores.scores[cur]}</p>`
        } else {
            fadeAudioOut(music.main);
            fadeAudioOut(music.main2);
            fadeAudioIn(music.mellow);
        }
    })
})()

/**Sets up the form to allow new votes */
function updateForm(length, clearVoted = true){
    document.getElementById("formHere").innerHTML=`
    ${selectOneInput("radio",length)}
    <input type='submit' class='button'>`
    let v = document.getElementById("voted");
    if(v != undefined && clearVoted){
        v.innerHTML = "";
    }
    let u = document.getElementById("user");
    if(u != undefined){
        u.innerHTML = "";
    }
}
/**Attached to the end game button to ensure there isn't an accidental restart */
function endGameButton(){
    if(confirm("Are you sure you want to end the game early?"))
        hostSendDataButton("gameEnd");
}


//Music

function makeAudio(src, loop = false, buffer=0.2){
    try{
        var b = new Audio("/"+src);
    } catch(e){
        console.error("Error getting file "+src);
        return;
    }
    b.volume = 1.0;
    if(loop){
        b.addEventListener('timeupdate', function(){
            if(this.currentTime > this.duration - buffer){
                this.currentTime = 0
                this.play()
            }
        });
    }
    return b;
}
function playAudio(src = "vote.wav", vol=1.0){
    try{
        var b = new Audio("/"+src);
    } catch(e){
        console.error("Error playing file "+src);
        return;
    }
    b.volume = vol;
    b.play();
    return b;
}

/**
 * Fades out the audio to silence
 * @param {HTMLAudioElement} audio 
 * @param {number} decrement 
 */
function fadeAudioOut(audio, decrement = 0.02, interval = 40){
    var fade = setInterval(()=>{
        if(audio.volume == 0){
            return;
        }
        audio.volume-=decrement;
        if(audio.volume - decrement <= 0){
            clearInterval(fade);
            audio.volume = 0;
            audio.pause();
        }
    }, interval)

}
function fadeAudioIn(audio, increment=0.02, interval = 35){
    if(audio.paused)
        audio.play();
    audio.volume = 0;
    var fade = setInterval(()=>{
        audio.volume+=increment;
        if(audio.volume + increment >= 1){
            clearInterval(fade);
            audio.volume = 1;
        }
    }, interval)
}
function crossFade(song1, song2){
    fadeAudioOut(song1);
    song2.volume = 0;
    fadeAudioIn(song2);
}

/**@param {HTMLAudioElement} song1 */
function playAfter(song1,song2){
    if(song1.paused){
        song1.play();
    }
    if(!song2.paused)
        song2.pause();
    song1.onended = function(){
        fadeAudioIn(song2, 0.05,30);
        song1.onended = undefined;
    }
}

var music = {
    main:makeAudio("music.wav",true,0.1),
    transition:makeAudio("transition.wav"),
    main2: makeAudio("music2.wav",true,0.13),
    stop:function(){
        music.main.pause();
        music.main2.pause();
        music.transition.pause();
        music.transition.currentTime = 0;
    },
    mellow: makeAudio("mellow.wav", true, 0.134)
};


//Used for removing the listener easily
var f;
//Music initialization. Cannot just auto play
if(isHost){
    var documentClickListener = document.addEventListener("click",f = function(e){
        music.main.loop = true;
        music.main.play();
        document.removeEventListener('click',f,true);
        console.log("CLICK")
    }, true)

    document.addEventListener("keyup",e=>{
        if(e.key == " "){
            console.log("SPAAAAAAAAAAACE")
            var order = ["Game-Start","Tally-Quotes","Next-Quote"];
            var e; 
            for(let i = 0; i < order.length;i++){
                e = document.getElementById(order[i]);
                if(e != undefined){
                    e.click();
                    return;
                }
            }
        } else if(e.key == "Escape"){

        }
    })
    
}