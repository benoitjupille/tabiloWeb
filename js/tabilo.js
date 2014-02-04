/*
 * TabiloWeb 
 * Author : Benoit Jupille
 * Version : 1.0
 * Website : http://labruiterie.com
 * 
 * Copyright 2013 Benoit Jupille
 * 
 * This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
*/

// Creation du context
var contextClass = (
	//window.AudioContext || 
  	window.webkitAudioContext
 );
if (contextClass) {
  // Web Audio API is available.
  var context = new contextClass();
} else {
    alert("Il semblerait que votre navigateur ne supporte pas le Web Audio API. Essayez avec Chrome ou Safari");
};

// Array avec les div vcoCircle qui représentent une voie
var vcoCircles = new Array();
vcoCircles.push($('#vco0Circle'));
vcoCircles.push($('#vco1Circle'));
vcoCircles.push($('#vco2Circle'));
vcoCircles.push($('#vco3Circle'));

// Array avec les div vcoKick qui représentent une voie kick
var kickCircles = new Array();
kickCircles.push($('#kick0Circle'));
kickCircles.push($('#kick1Circle'));

// sert à compter les ticks du metronome
var counter = 3;
	
$(document).ready(function(){
	
	// Une fois le bouton start appuyé, on démarre les oscillators avec noteOn
	// Pour fonctionner sur Ipad, il faut obligatoirement une action utilisateur qui démarre avec un noteOn()
	// Ensuite on déclare tous les events
	// Ensuite on lance le metronome et la boucle
	$('#start').click(function(){
		
  		$( "#helpGeneral" ).toggle( "fade", 1000 );
		
		/* Ceci ne fonctionne plus sur la nouvelle version de Chrome !!
		Donc pas sûr que ce soit encore bon pour Safari iOS :(
		
 		for(var i=0; i<4; i++){
 			oscillators[i].oscillator.noteOn(context.currentTime);
 		};
 		
 		*/
 		$(this).fadeOut(1000);
 		$('#master').fadeIn(1000);
 		
		initHelpButton();
 		initjQueryEvents();
 		initKnobsEvents();
 		metronomeLoop();
 	});
    

    /*********************************** CLASSES ***********************************/
   
    //----------- CLASS VCO -----------//
    var VCO = (function(context){
        function VCO(){
            this.oscillator = context.createOscillator();
            this.oscillator.type = 'square';
            this.setNoteMIDI(36);
            this.oscillator.start(0);
            
            this.input = this.oscillator;
            this.output = this.oscillator;
            
            var that = this;
            $(document).bind('noteMIDI', function (_, noteMIDI) {
                that.setNoteMIDI(noteMIDI);
            });
        };
        
        VCO.prototype.setNoteMIDI = function(_noteMIDI){
        	// Convertit un nombre de note MIDI en Hz
        	var frequency = Math.pow(2, (_noteMIDI - 69) / 12) * 440.0;
            this.oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        };
        
        VCO.prototype.connect = function(node){
            if(node.hasOwnProperty('input')){
                this.output.connect(node.input);
            }else{
                this.output.connect(node);
            };
        };
        
        return VCO;
    }) (context);
    
    //----------- CLASS KICK -----------//
    var KICK = (function(context){
        function KICK(){
            this.oscillator = context.createOscillator();
            this.oscillator.type = 'triangle';
            this.oscillator.start(0);
            
            this.input = this.oscillator;
            this.output = this.oscillator;
            
            this.delayTime = 0.0;
            
            var that = this;
            $(document).bind('noteMIDI', function (_) {
                that.setNoteMIDI();
            });
        };
        
        KICK.prototype.trigger = function(){
            this.oscillator.frequency.setValueAtTime(440, context.currentTime + this.delayTime);
            this.oscillator.frequency.linearRampToValueAtTime(100, context.currentTime + 0.03 + this.delayTime);
        };
        
        KICK.prototype.setDelay = function(_delay){
        	this.delayTime = _delay;
        };
        
        KICK.prototype.connect = function(node){
            if(node.hasOwnProperty('input')){
                this.output.connect(node.input);
            }else{
                this.output.connect(node);
            };
        };
        
        return KICK;
    }) (context);

    //----------- CLASS ENVELOPPE -----------//
    var EnvelopeGenerator = (function(context){
        function EnvelopeGenerator(){
            this.attackTime = 0.01;
            this.releaseTime = 0.5;
            this.delayTime = 0.0;
            this.volume = 0.05;
            
            var that = this;
            $(document).bind('gateOn', function(_){
                that.trigger();
            });
            $(document).bind('attack', function (_, value) {
                that.setAttack(value);
            });
            $(document).bind('release', function (_, value) {
                that.setRelease(value);
            });
            $(document).bind('delay', function (_, value) {
                that.setDelay(value);
            });
        };
        
        EnvelopeGenerator.prototype.setAttack = function(_attack){
        	this.attackTime = _attack;
        };
        
        EnvelopeGenerator.prototype.setRelease = function(_release){
        	this.releaseTime = _release;
        };
        
        EnvelopeGenerator.prototype.setDelay = function(_delay){
        	this.delayTime = _delay;
        };
        
        EnvelopeGenerator.prototype.setVolume = function(_volume){
			this.volume = _volume;
		};
        
        EnvelopeGenerator.prototype.trigger = function(){
            now = context.currentTime + this.delayTime;
            this.param.cancelScheduledValues(now);
            this.param.setValueAtTime(0, now);
            this.param.linearRampToValueAtTime(this.volume, now + this.attackTime);
            this.param.linearRampToValueAtTime(0, now + this.attackTime + this.releaseTime);
        };
        EnvelopeGenerator.prototype.connect = function(_param) {
            this.param = _param;
        };
        
        return EnvelopeGenerator;
    }) (context);
    
    //----------- CLASS VCA -----------//
    var VCA = (function(context) {
        function VCA() {
            this.gain = context.createGain();
            this.gain.gain.value = 0;
            this.input = this.gain;
            this.output = this.gain;
            this.amplitude = this.gain.gain;
        };
		
        VCA.prototype.connect = function(node) {
            if (node.hasOwnProperty('input')) {
              this.output.connect(node.input);
            } else {
              this.output.connect(node);
            };
        };

        return VCA;
    })(context);
    /***************************************************************************/
   
   
   
   
    
    /***************************** CREATION OBJETS *****************************/
	var oscillators = new Array();
    var amplitudes = new Array();
    var envelopes = new Array();
    var filters = new Array();
    
    var kicks = new Array();
    var kicksAmplitudes = new Array();
    var kicksEnvelopes = new Array();

	for(var i=0; i<4; i++){
		oscillators.push(new VCO());
		
		amplitudes.push(new VCA());
		
		envelopes.push(new EnvelopeGenerator());
		envelopes[i].setAttack(0.01);
		envelopes[i].setRelease(0.5);
		envelopes[i].setVolume(0.0);
		
		filters.push(context.createBiquadFilter());
		filters[i].type = 0; 
		filters[i].frequency.value = 20000; 
				
		oscillators[i].connect(amplitudes[i]);
	    envelopes[i].connect(amplitudes[i].amplitude);
	    amplitudes[i].connect(filters[i]);
	    filters[i].connect(context.destination);
	};
	
	for(var i=0; i<2; i++){
		kicks.push(new KICK());
		kicksAmplitudes.push(new VCA());
		kicksEnvelopes.push(new EnvelopeGenerator());
		kicksEnvelopes[i].setRelease(0.1);
		kicksEnvelopes[i].setVolume(0.0);

		
		kicks[i].connect(kicksAmplitudes[i]);
		kicksEnvelopes[i].connect(kicksAmplitudes[i].amplitude);
		kicksAmplitudes[i].connect(context.destination);
	};
	/**************************************************************************/
    
    
    
    /**************************** FUNCTIONS ********************************/
   	function initHelpButton(){
   		$( "#showHelp" ).click(function() {
  			$( "#helpGeneral" ).toggle( "fade", 1000 );
		});
   	};
   	
	function initjQueryEvents(){
		
		$('.vco').draggable({handle: '.vcoCircle', containment: 'parent'});
   	 	$('.kick').draggable({handle: '.kickCircle', containment: 'parent'});
   	 	
		// Afficher les knobs quand on appuye sur un élément
		$( "#vco0Circle" ).click(function() {
  			$( "#vco0Parm" ).toggle( "fade", 100 );
		});
		
		$( "#vco1Circle" ).click(function() {
  			$( "#vco1Parm" ).toggle( "fade", 100 );
		});
	    
	    $( "#vco2Circle" ).click(function() {
  			$( "#vco2Parm" ).toggle( "fade", 100 );
		});  
		
		$( "#vco3Circle" ).click(function() {
  			$( "#vco3Parm" ).toggle( "fade", 100 );
		});
		
		$( "#kick0Circle" ).click(function() {
  			$( "#kick0Parm" ).toggle( "fade", 100 );
		});
		
		$( "#kick1Circle" ).click(function() {
  			$( "#kick1Parm" ).toggle( "fade", 100 );
		});
		
	    // On règle le volume en draggant les éléments
	    $('#vco0Circle').mousedown(function(){
	    	$(this).mousemove(function(){
	    		volume = calculVolumeVco($(this));
	    		envelopes[0].setVolume(volume);
	    	});
    	});
	
		$('#vco1Circle').mousedown(function(){
	    	$(this).mousemove(function(){
	    		volume = calculVolumeVco($(this));
	    		envelopes[1].setVolume(volume);
	    	});
	    });
	    
	    $('#vco2Circle').mousedown(function(){
	    	$(this).mousemove(function(){
	    		volume = calculVolumeVco($(this));
	    		envelopes[2].setVolume(volume);
	    	});
	    });
	    
	    $('#vco3Circle').mousedown(function(){
	    	$(this).mousemove(function(){
	    		volume = calculVolumeVco($(this));
	    		envelopes[3].setVolume(volume);
	    	});
	    });
	    
	    $('#kick0Circle').mousedown(function(){
	    	$(this).mousemove(function(){
	    		volume = calculVolumeKick($(this));
	    		kicksEnvelopes[0].setVolume(volume);
	    	});
	    });
	    
	    $('#kick1Circle').mousedown(function(){
	    	$(this).mousemove(function(){
	    		volume = calculVolumeKick($(this));
	    		kicksEnvelopes[1].setVolume(volume);
	    	});
	    }); 
	};
	
	function initKnobsEvents(){
		// ---------------------------------- KNOBS -------------------------------------
	    // Fix it : J'ai essayé de looper ça, pas moyen ?
	    
	    // ---- Knob 0	
		$('#vco0Pitch').knob({
	   		'change' : function (v) { oscillators[0].setNoteMIDI(v); }
		});
		
		$('#vco0Attack').knob({
	    	'change' : function (v) { envelopes[0].setAttack(v / 100); }
		});
		
		$('#vco0Release').knob({
			'change' : function (v) { envelopes[0].setRelease(v / 100); }
		});
		
		$('#vco0Delay').knob({
			'change' : function (v) { envelopes[0].setDelay(v / 100); }
		});
		
		$('#vco0Cutoff').knob({
			'change' : function (v) { filters[0].frequency.value = v; }
		});
		
		// ---- Knob 1	
		$('#vco1Pitch').knob({
	   		'change' : function (v) { oscillators[1].setNoteMIDI(v); }
		});
		
		$('#vco1Attack').knob({
	    	'change' : function (v) { envelopes[1].setAttack(v / 100); }
		});
		
		$('#vco1Release').knob({
			'change' : function (v) { envelopes[1].setRelease(v / 100); }
		});
		
		$('#vco1Delay').knob({
			'change' : function (v) { envelopes[1].setDelay(v / 100); }
		});
		
		$('#vco1Cutoff').knob({
			'change' : function (v) { filters[1].frequency.value = v; }
		});
		
		// ---- Knob 2	
		$('#vco2Pitch').knob({
	   		'change' : function (v) { oscillators[2].setNoteMIDI(v); }
		});
		
		$('#vco2Attack').knob({
	    	'change' : function (v) { envelopes[2].setAttack(v / 100); }
		});
		
		$('#vco2Release').knob({
			'change' : function (v) { envelopes[2].setRelease(v / 100); }
		});
		
		$('#vco2Delay').knob({
			'change' : function (v) { envelopes[2].setDelay(v / 100); }
		});
		
		$('#vco2Cutoff').knob({
			'change' : function (v) { filters[2].frequency.value = v; }
		});
		
		// ---- Knob 3	
		$('#vco3Pitch').knob({
	   		'change' : function (v) { oscillators[3].setNoteMIDI(v); }
		});
		
		$('#vco3Attack').knob({
	    	'change' : function (v) { envelopes[3].setAttack(v / 100); }
		});
		
		$('#vco3Release').knob({
			'change' : function (v) { envelopes[3].setRelease(v / 100); }
		});
		
		$('#vco3Delay').knob({
			'change' : function (v) { envelopes[3].setDelay(v / 100); }
		});
		
		$('#vco3Cutoff').knob({
			'change' : function (v) { filters[3].frequency.value = v; }
		});
		
		// ---- Knob kick 0	
		$('#kick0Delay').knob({
			'change' : function (v) { kicks[0].setDelay(v / 100); },
			'change' : function (v) { kicksEnvelopes[0].setDelay(v / 100); }
		});
		
		// ---- Knob kick 1	
		$('#kick1Delay').knob({
			'change' : function (v) { kicks[1].setDelay(v / 100); },
			'change' : function (v) { kicksEnvelopes[1].setDelay(v / 100); }
		});
		
	    // ---------------------------------- FIN KNOBS -------------------------------------
	};
	
	function calculVolumeVco(vcoCircle){
		var volume = 0;
		var distanceX = vcoCircle.offset().left - $('#master').offset().left;
		distanceX = Math.abs(distanceX);
		var distanceY = vcoCircle.offset().top - $('#master').offset().top;
		distanceY = Math.abs(distanceY);
		volume = ((((distanceX + distanceY) / 1000) * -1) + 1) * 0.2;
		volume = volume - 0.1;
		if(volume < 0){
			volume = 0;
		};
		return volume;
	};
	
	function calculVolumeKick(kickCircle){
		var volume = 0;
		var distanceX = kickCircle.offset().left - $('#master').offset().left;
		distanceX = Math.abs(distanceX);
		var distanceY = kickCircle.offset().top - $('#master').offset().top;
		distanceY = Math.abs(distanceY);
		volume = ((((distanceX + distanceY) / 1000) * -1) + 1) * 0.5;
		if(volume < 0){
			volume = 0;
		};
		return volume;
	};	
	
	function metronomeLoop(){
		// 4 temps par seconde
		$.metronome.start(4); 
		
		// A chaque event tick du metronome
		$(document).bind('tick', function(){
			counter = counter + 1;
	        if(counter === 4){
	        	counter = 0;
	        };
	        
	        // On déclence les enveloppes des VCO
	        envelopes[counter].trigger();
	        
	        //Fait clignoter le div qui représente le VCO
	       vcoCircles[counter].fadeToggle(80, 'swing', function(){$(this).fadeTo(80, 1)});
	        
	        // On déclenche les enveloppes kicks sur les temps 0 et 2
	        if(counter === 0){
	      	  	kicks[0].trigger();
	       		kicksEnvelopes[0].trigger();
	       		//Fait clignoter le div qui représente le kick
	       		kickCircles[0].fadeToggle(80, 'swing', function(){$(this).fadeTo(80, 1)});
	       	};
	       	if(counter === 2){
	      	  	kicks[1].trigger();
	       		kicksEnvelopes[1].trigger();
	       		//Fait clignoter le div qui représente le kick
	       		kickCircles[1].fadeToggle(80, 'swing', function(){$(this).fadeTo(80, 1)});
	       	};
		});
	};				
});




