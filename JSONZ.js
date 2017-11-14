// Copyright (c) 2017 Bruno PIERRE <brunopierre4@yahoo.fr>
// This work is free. You can redistribute it and/or modify it under the terms of the WTFPL, Version 2
// For more information see LICENSE.txt or http://www.wtfpl.net/
//
// JSONZ compression algorithm, version 1
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    global.JSONZ = factory()
}(this, (function() {

    function Translator(BASESTART){
      var 
        BASE = 16,
        BASEEND = BASESTART+BASE;
      
      this.encode = function(idx){
        var d= idx & 15,res = String.fromCharCode(d+BASESTART);
        idx = idx>>4
        while (idx > 0){
          d = idx & 15;
          res = String.fromCharCode(d+BASESTART)+res;
          idx = idx>>4;
        } 
        return res;
      }
      
      this.decodeFromCharCode = function(array){
        var res = (array[0] - BASESTART);
        for (var i = 1,len = array.length; i < len; i++) {
          res = (res <<4) + (array[i] - BASESTART);
        }
        return res;
      }

      
      this.match = function(code){
        return code>=BASESTART && code<BASEEND;
      }
    }
    
    var translatorValue = new Translator(65),translatorKey=new Translator(97);
 
    function numbermatch(code){
      //replace ^ by e
      if(code===94) return 69;
      //accept numbers + - and .
      return ((code>=48 && code <58)||code===43||code===46||code===45)?code:0;
    }
    function numberencode(number){
      return number.toString().replace('e','^');
    }
    
    function StringDictionnary(){
      var map={},size=0;
      this.array = []
      this.push = function(str){
        var res = map[str];
        if(res===undefined){
          this.array.push(str);
          res = map[str] = size;
          size++;
        }
        return res;
      }
      
    }
    
    function transform(json) {
      var dicoKey = new StringDictionnary(), dicoValue = new StringDictionnary();

      function handle(value) {
        switch(typeof value){
          case 'object':{
            if(value===null){
              return '*';
            }else if (Array.isArray(value)) {
              return handlearray(value);
            } else if (typeof value === 'object') {
              return handleobject(value);
            }    
          }
          case 'boolean':{
            return value?"#":"!";
          }
          case 'number':{
            return numberencode(value);
          }
          case 'string':{
            return translatorValue.encode(dicoValue.push(value));
          }
          default:{
            throw new Error(value+" not encodable in json");
          }
        }
      }

      function handleobject(obj) {
        var dico, value, resString = "{";

        for (var name in obj) {
          if (obj.hasOwnProperty(name)) {
            dico = translatorKey.encode(dicoKey.push(name));
            value = handle(obj[name]);
            resString += dico + value;
          }
        }

        resString += "}";
        return resString;
      }
      function handlearray(obj) {
        var value,resString = "[";
        for (var i = 0,len=obj.length; i < len; i++) {
          value = handle(obj[i]);
          if(i!==0 && typeof obj[i]!=='object'){
            resString+=',';
          }
          resString += value;
        }
        resString += "]";
        return resString;
      }
      return [handle(json), dicoKey.array, dicoValue.array ];
    }
    function untransform(struct) {

      var 
        str = struct[0], 
        dicoKey = struct[1], 
        dicoValue = struct[2],
        
        ctxs = [], keys = [], idx = 0;
      
      function pushValue(val) {
        var key = keys[idx], ctx = ctxs[idx];
        //if it is an array
        if (key === null) {
          ctx.push(val);
        //happen only the first time and so create the main object
        } else if (key === undefined) {
          ctxs[idx] = val;
        } else {
          ctx[key] = val;
        }
      }
      function pushContext(val) {
        pushValue(val);
        idx++;
        ctxs[idx] = val;
      }
        
      
      for(var i=0,len=str.length,charCode;i<len;){
        charCode = str.charCodeAt(i);
        i++;
        switch(charCode){
          case 123:{
            pushContext({});
            break;
          }
          case 91:{
            pushContext([]);
            keys[idx] = null;
            break;
          }
          case 125:
          case 93:
            idx--;
            break;
          //for true T
          case 35:
            pushValue(true);
            break;
          //for false U  
          case 33:
            pushValue(false);
            break;
          //for null *
          case 42:  
            pushValue(null);
            break;
          //for number starts with - and numbers
          case 45:case 48:case 49:case 50:case 51:case 52:case 53:case 54:case 55:case 56:case 57:{
            var value = [charCode],translated;
            
            while((translated=numbermatch(charCode = str.charCodeAt(i))) && i<len){
              value.push(translated);
              i++;
            }  
            
            pushValue(Number(String.fromCharCode.apply(null, value)));
            break;
          }
              
          default:{
            if(translatorValue.match(charCode)){
              var value = [charCode];
              while((translatorValue.match(charCode = str.charCodeAt(i))) && i<len){
                value.push(charCode);
                i++;
              }  
              pushValue(dicoValue[translatorValue.decodeFromCharCode(value)]);
            }else if(translatorKey.match(charCode)){
              var key = [charCode];
              while(translatorKey.match(charCode = str.charCodeAt(i))){
                key.push(charCode);
                i++;
              }
              keys[idx] = dicoKey[translatorKey.decodeFromCharCode(key)];
            }
          }  
        }
      }
      return ctxs[0];
      
    }
    return {
      stringify : function(json){
        var struct = transform(json);
        return JSON.stringify(struct);
      },
      parse : function(jsonasstring){
        return untransform(JSON.parse(jsonasstring))
       },
      transform : transform,
      untransform : untransform
    }
})));