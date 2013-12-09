exports.impress = {
    date : Date,
    pid : Number,
    url : String,
    url_id : Number,
    content : String,
    length : Number,
    category : Number,          // [] => 0, [2-7] => 1, (7-12] => 2
    changePercent : Number,     // ...
    containBadWord : Boolean,   // if impress contain a word from stop-list
    badWord : String,           // if containBadWord == true, there would be stop-word
    batched : Boolean           // if containBadWord == false, there would be true, when helper transports impress to text
};

exports.text = {
    date : Date,
    pid : Number,
    url : String,
    url_id : Number,
    content : String,
    length : Number,
    category : Number
};

exports.ferry_task = {
    date : Date,
    pid : Number,
    url_ids : Array
};