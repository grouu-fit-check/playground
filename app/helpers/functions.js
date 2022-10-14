var dateTime = require('node-datetime');
var ip = require('ip');
var sanitizer = require('sanitizer');

const nodemailer = require('nodemailer');
const fs = require('fs');
const mustache = require('mustache');

const crypto = require("crypto");
const algorithm = 'aes-256-cbc';
const key = "jkasdlkajsklj3242342^$@#%@#$%";
const iv = "lkjglksjwl@#$@#$@xxx";

const hashEquals = require('hash-equals');

/**
 * @author Mas Pray
 */
module.exports = {

    base64_decode: function(encrypted_string){
        try{
            return Buffer.from(encrypted_string, 'base64').toString('binary');
        }catch(ex){
            return "";
        }
    },

    base64_encode: function(string){
        try{
            return Buffer.from(string).toString('base64');
        }catch(ex){
            return "";
        }
    },

    sanitizeString: function(source){
        var ret = sanitizer.escape(source);
        return ret;
    },

    getClientIp: function(){
        return ip.address();
    },

    signHmacSha512(key, str) {
        let hmac = crypto.createHmac("sha512", key);
        let signed = hmac.update(Buffer.from(str, 'utf-8')).digest("hex");
        return signed
    },

    getKeySHA512(){
        let key = "kjsdfjhsdfkljh.,mnsdf15213432t13432516s8d64fs sdlkjfrlk4n5t,nskndfs*#@$%#@$%907lkkl.jalksjdlkajsdlkjaslkdj_+3234234"; //SHA512 Key Standart
        return key;
    },

    encrypt(text) {
        let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
        let encrypted = cipher.update(text.toString());
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return encrypted.toString('hex');
    },

    decrypt(text) {
        // let iv = Buffer.from(text.iv, 'hex');
        let encryptedText = Buffer.from(text, 'hex');
        let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    },

    encryptPassword(known_string){ //Author Prayogi
        let key = this.getKeySHA512(); //SHA512 Key Standart
        let hmac = crypto.createHmac("sha512", key);
        let signed = hmac.update(Buffer.from(known_string, 'utf-8')).digest("hex");

        console.log('known_string', known_string);
        console.log('signed', signed);

        return signed
    },

    validatePassword(known_string, encrypted_string){ //Author Prayogi
        let key = this.getKeySHA512(); //SHA512 Key Standart
        let hmac = crypto.createHmac("sha512", key);
        let signed = hmac.update(Buffer.from(known_string, 'utf-8')).digest("hex");

        console.log('known_string', known_string);
        console.log('signed', signed);
        console.log('encrypted_string', encrypted_string);

        try{
            if(hashEquals(signed, encrypted_string)){
                return true;
            }else{
                return false;
            }
        }catch(err){
            return false;
        }
    },

    encryptToken(text) {
        const AES_METHOD = 'aes-256-cbc';
        const IV_LENGTH = 16; // For AES, this is always 16, checked with php

        const password = 'abcdefghijklmnopqrstuvwxyz123456$'; // Must be 256 bytes (32 characters)
        if (process.versions.openssl <= '1.0.1f') {
            throw new Error('OpenSSL Version too old, vulnerability to Heartbleed')
        }

        let iv = crypto.randomBytes(IV_LENGTH);
        let cipher = crypto.createCipheriv(AES_METHOD, new Buffer(password), iv);
        let encrypted = cipher.update(text);

        encrypted = Buffer.concat([encrypted, cipher.final()]);

        return iv.toString('hex') + ':' + encrypted.toString('hex');
    },

    decryptToken(text) {
        const password = '654321abcdefghiujklmnopqstuvwxyz$'; // Must be 256 bytes (32 characters)

        let textParts = text.split(':');
        let iv = new Buffer(textParts.shift(), 'hex');
        let encryptedText = new Buffer(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', new Buffer(password), iv);
        let decrypted = decipher.update(encryptedText);

        decrypted = Buffer.concat([decrypted, decipher.final()]);

        return decrypted.toString();
    },

    makeRandomToken() {
        let lengthOfCode = 40;
        let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
        let text = "";
        for (let i = 0; i < lengthOfCode; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
          return text;
    },
    generateRandomString() {
        let lengthOfCode = 4;
        let possible = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        let text = "";
        for (let i = 0; i < lengthOfCode; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
          return text;
    },

    formatRupiah(angka, prefix){
        prefix = true;

        let nilai = 0;
        if(parseInt(angka) > 0){
            nilai = angka.toString();
        }else{
            nilai = nilai.toString();
        }


        angka = nilai.replace('.',',').toString();
        var number_string = nilai.replace(/[^,\d]/g, '').toString(),
        split   		= number_string.split(','),
        sisa     		= split[0].length % 3,
        rupiah     		= split[0].substr(0, sisa),
        ribuan     		= split[0].substr(sisa).match(/\d{3}/gi);
        // tambahkan titik jika yang di input sudah menjadi angka ribuan
        if(ribuan){
            separator = sisa ? '.' : '';
            rupiah += separator + ribuan.join('.');
        }

        rupiah = split[1] != undefined ? rupiah + ',' + split[1] : rupiah;
        return prefix == undefined ? rupiah : (rupiah ? 'Rp. ' + rupiah : '');
    },

    formatDateMonth(datestring = null){
        if (datestring === null) {
            return '';
        }
        const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
        ];

        var d = new Date(datestring);
        //get the month
        var month = d.getMonth();
        //get the day
        //convert day to string
        var day = d.getDate().toString();
        //get the year
        var year = d.getFullYear();

        //pull the last two digits of the year
        year = year.toString();

        //increment month by 1 since it is 0 indexed
        //converts month to a string
        month = (month + 1).toString();

        //if month is 1-9 pad right with a 0 for two digits
        if (month.length === 1)
        {
            month = "0" + month;
        }

        //if day is between 1-9 pad right with a 0 for two digits
        if (day.length === 1)
        {
            day = "0" + day;
        }

        //return the string "MMddyy"
        return day + ' ' + monthNames[d.getMonth()] + ' ' + year;
    },

    formatDateMonthV2(datestring = null){
        if (datestring === null) {
            return '';
        }
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        ];

        const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

        var d = new Date(datestring);

        //return the string "MMddyy"
        return days[d.getDay()] + ', ' + d.getDate()+ ' ' + monthNames[d.getMonth()];
    },

    formatDateMonthV3(datestring = null){
        if (datestring === null) {
            return '';
        }
        const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
        ];

        const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

        var d = new Date(datestring);

        var year = d.getFullYear();

        var hour =  ("0" + (d.getHours())).slice(-2);
        var min =  ("0" + (d.getMinutes())).slice(-2);

        //pull the last two digits of the year
        year = year.toString();
        hours = hour.toString();
        minutes = min.toString();


        //return the string "MMddyy"
        return days[d.getDay()] + ', ' + d.getDate()+ ' ' + monthNames[d.getMonth()]  + ' ' + year + " "+ hours+":"+minutes;
    },

    GetFormattedDate(dateString) {
        date = new Date(dateString);
        var month = ("0" + (date.getMonth() + 1)).slice(-2);
        var day  = ("0" + (date.getDate())).slice(-2);
        var year = date.getFullYear();
        var hour =  ("0" + (date.getHours())).slice(-2);
        var min =  ("0" + (date.getMinutes())).slice(-2);
        var seg = ("0" + (date.getSeconds())).slice(-2);
        return year + "-" + month + "-" + day + " " + hour + ":" +  min + ":" + seg;
    },

    formatDate(datestring = null){
        if (datestring === null) {
            return '';
        }
        var d = new Date(datestring);
        //get the month
        var month = d.getMonth();
        //get the day
        //convert day to string
        var day = d.getDate().toString();
        //get the year
        var year = d.getFullYear();

        //pull the last two digits of the year
        year = year.toString();

        //increment month by 1 since it is 0 indexed
        //converts month to a string
        month = (month + 1).toString();

        //if month is 1-9 pad right with a 0 for two digits
        if (month.length === 1)
        {
            month = "0" + month;
        }

        //if day is between 1-9 pad right with a 0 for two digits
        if (day.length === 1)
        {
            day = "0" + day;
        }

        //return the string "MMddyy"
        return year + '-' + month + '-' + day;
    },
    formatDateForInvoice() {
        var d = new Date();
        //get the month
        var month = d.getMonth();
        //get the day
        //convert day to string
        var day = d.getDate().toString();
        //get the year
        var year = d.getFullYear();

        //pull the last two digits of the year
        year = year.toString().substr(-2);

        //increment month by 1 since it is 0 indexed
        //converts month to a string
        month = (month + 1).toString();

        //if month is 1-9 pad right with a 0 for two digits
        if (month.length === 1)
        {
            month = "0" + month;
        }

        //if day is between 1-9 pad right with a 0 for two digits
        if (day.length === 1)
        {
            day = "0" + day;
        }

        //return the string "MMddyy"
        return year + month + day;
    },

    dateNow() {
        var today = new Date();
        var date = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();
        var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
        var date_time = date + ' ' + time;

        return date_time;
    },
    currentDate() {
        var today = new Date();
        var date = today.getFullYear() + '-' + (today.getMonth()+1) + '-' + today.getDate();

        return date;
    },
    addDays(datestring, days) {
        const date = new Date(datestring)
        date.setDate(date.getDate() + days)

        return this.GetFormattedDate(date);
    },
    addMonth(datestring, months) {
        const date = new Date(datestring)
        date.setMonth(date.getMonth() + months)

        return this.formatDate(date);
    },
    minMonth(datestring, months) {
        const date = new Date(datestring)
        date.setMonth(date.getMonth() - months)

        return this.formatDate(date);
    },
    minDay(datestring, days) {
        const date = new Date(datestring)
        date.setDate(date.getDate() - days)

        return this.formatDate(date);
    },
    // addMinutes(datestring, minutes) {
    //     const date = new Date(datestring)
    //     date.setDate(date.getMinutes() + minutes)

    //     return this.GetFormattedDate(date);
    // }
    addMinutes(datestring, minutes) {
        var d1 = new Date (datestring),
        d2 = new Date ( d1 );
        d2.setMinutes ( d1.getMinutes() + minutes );
        return this.GetFormattedDate(d2);
    },

    removeSpecialCharacter(characters){
        var formatted = characters.replace(/[^a-zA-Z ]/g, "");

        return formatted;
    }
}