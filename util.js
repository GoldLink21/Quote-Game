const { readFileSync, writeFileSync } = require("fs");
exports.resetVotes = function(){
    writeFileSync("./data/votes.json","{}");
}
exports.resetScores = function(){
    writeFileSync("./data/playerScores.json","{}");
}
exports.resetCurrentQuote = function(){
    writeFileSync("./data/currentQuote.json","{}");
}
exports.tag = function (str,tag){
    return "<"+tag+">"+str+"</"+tag+">";
}
exports.fileToHTML = function(fileName, elementType, parameters=''){
    return `<${elementType} ${parameters}>${readFileSync("./"+fileName)}</${elementType}>`
}
/**@returns {-1|-2|-3|1} 1 if there was a user to add the vote to, otherwise returns a negative value for specific errors */
exports.addToVotes = function(toAdd){
    //Check people[#] for all possible needed;
    if(toAdd.user == undefined || toAdd.user == ''){
        return -1;
    }
    var value = exports.parseInputs(toAdd)
    if(value.includes("undefined")){
        return -2;
    }
    //Check for same person voting
    if('people1' in toAdd && 'people2' in toAdd){
        if(toAdd.people1 == toAdd.people2 )
            return -3;
        if('people3' in toAdd && (toAdd.people1 == toAdd.people3 || toAdd.people2 == toAdd.people3))
            return -3;
    }
    var data = JSON.parse(readFileSync("./data/votes.json"));
    data[toAdd.user] = value;
    writeFileSync("./data/votes.json",JSON.stringify(data));
    return 1;
}
/**Parses the parameters send in from the client form to get their votes */
exports.parseInputs = function (params){
    var cur = Object.keys(JSON.parse(readFileSync("./data/currentQuote.json")).people);
    //return cur.reduce( (a, b, i, array) => a + ( i < array.length - 1 ? ', ' : (array.length > 2 ? ', and ' : ' and ') ) + b);
    
    var key = ''
    if(cur.length == 1){
        key = params.people1;
    } else if(cur.length == 2){
        key = `${params.people1} and ${params.people2}`
    } else {
        for(let i=0;i<cur.length;i++){
            key+=params["people"+(i+1)];
            if(i < cur.length-1){
                key+=', ';
            }
            if(i == cur.length-2){
                key+='and ';
            }
        }
    }
    return key
}
/**Used for end screen to get final scores */
exports.getWinners = function(){
    var playerScores = JSON.parse(readFileSync("./data/playerScores.json"));
    var winKeys = [];
    var topScore = -1;
    for(let player in playerScores){
        if(playerScores[player] > topScore){
            topScore = playerScores[player];
            winKeys = [player];
        }
        else if(playerScores[player] == topScore) {
            winKeys.push(player);
        }
    }
    var out = {winners:winKeys,scores:playerScores};
    return out;
}
/**Gets args passed into node server.js command */
exports.getArgs = function(){return process.argv;}

exports.randInt = function(to){return Math.floor(Math.random()*to)}

/**Parses dialogue into a readable string */
exports.parseDialogue = function(q) {
    var out = '';
    q.forEach(line=>{
        out += '"'+line.quote+'"' + " - ";
        if(line.person.length == 1){
            out+=line.person[0];
        } else if(line.person.length == 2) {
            out += line.person[0] + " and " + line.person[1];
        } else {
            for(let i = 0; i < line.person.length - 1; i++){
                out += line.person[i]+", "
            }
            out += "and " + line.person[line.person.length - 1];
        }
        out = exports.tag(out,"p");
    });
    return out;
}
/**@param {{person:string[],quote:string}[]} dialogue */
exports.countPeopleInDialogue = function(dialogue){
    var tracked = [];
    dialogue.forEach(d=>{
        d.person.forEach(p=>{
            if(!tracked.includes(p)){
                tracked.push(p);
            }
        })
    });
    return tracked.length;
}

exports.putIntoEnglishList = function(...objs) {
    var key = ''
    if(objs.length == 1){
        key = objs[0];
    } else if(objs.length == 2){
        key = `${objs[0]} and ${objs[1]}`
    } else {
        for(let i=0;i<objs.length;i++){
            key+=objs[i];
            if(i < objs.length-1){
                key+=', ';
            }
            if(i == objs.length-2){
                key+='and ';
            }
        }
    }
    return key
}
exports.shuffleArray = function(arr){
    return arr.map((a) => ({sort: Math.random(), value: a}))
        .sort((a, b) => a.sort - b.sort)
        .map((a) => a.value);
}

/**@returns {{person:string[],quote:string}[]} [{"person":["Kate"],"quote":"Cake is a salad! Its an inconvenient salad!!!!"}]*/
exports.getShuffledQuotes = function(){
    var quotes = JSON.parse(readFileSync("./quotes.json")).quotes;    
    return exports.shuffleArray(quotes);
}
/**Counts up how many quotes there are */
exports.countQuoteAmount = function(){
    let c = {};
    var total = 0;
    var quotes = JSON.parse(readFileSync("./quotes.json"));
    quotes.people.forEach(p=>{
        c[p]=0;
    })
    quotes.quotes.forEach(q=>{
        q.dialogue.forEach(d=>{
            d.person.forEach(p=>{
                c[p]++;
                total++;
            });
        });
    });
    let sortable = [];
    for (var count in c)
        sortable.push([count,c[count]]);
    return sortable.sort((a,b)=>b[1]-a[1]).map(e=>e.join(": ")).join("<br>\n") + "<br>\nTotal: "+total;
}
