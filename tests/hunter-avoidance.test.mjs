import test from 'node:test';import assert from 'node:assert/strict';
import {Game,LAND} from '../public/game/engine.mjs';
import {SPECIES} from '../public/game/species.mjs';
function setup(species='basic',dir=1){const g=new Game();g.dogs=[];const z=g.prey[0];Object.assign(z,{species,x:1000,y:LAND[0].y,dir,state:'run',grounded:true,turnLock:0});g.player.invulnerable=100;return {g,z};}
test('all five species turn away when the hunter overtakes on foot or by jetpack, in both directions and frame rates',()=>{
 for(const species of Object.keys(SPECIES))for(const dir of [-1,1])for(const fps of [25,60,120])for(const airborne of [false,true]){
  const {g,z}=setup(species,dir);g.player.x=z.x-dir*180;g.player.y=z.y;g.update(1/fps);assert.equal(z.dir,dir);
  const x=z.x;g.player.x=x+dir*120;g.player.y=airborne?165:z.y;g.update(1/fps);assert.equal(z.dir,-dir,`${species} ${dir} ${fps} ${airborne}`);assert.ok((z.x-x)*dir<0);assert.equal(z.state,'run');
 }
});
test('close overlap and distant hunter do not cause arbitrary reversals',()=>{
 const {g,z}=setup();for(let i=0;i<30;i++){g.player.x=z.x+(i%2?30:-30);g.player.y=z.y-120;g.update(1/60);assert.equal(z.dir,1);}
 g.player.x=z.x+600;g.update(1/60);assert.equal(z.dir,1);
});
test('a brief turn lock prevents rapid reversals but a second real interception works',()=>{
 const {g,z}=setup();g.player.x=z.x+120;g.player.y=z.y-120;g.update(1/60);assert.equal(z.dir,-1);
 for(let i=0;i<10;i++){g.player.x=z.x-120;g.player.y=z.y-120;g.update(1/60);assert.equal(z.dir,-1);}
 for(let i=0;i<20;i++){g.player.x=z.x-120;g.player.y=z.y-120;g.update(1/60);}assert.equal(z.dir,1);
});
test('interception interrupts a shoreline taunt before the committed dive',()=>{
 for(const dir of [-1,1]){
  const {g,z}=setup('basic',dir);Object.assign(z,{x:dir>0?LAND[0].end-120:LAND[0].x+120,state:'taunt',tauntExit:dir>0?LAND[0].end-38:LAND[0].x+38,tauntDuration:.12,timer:.11,tauntSpeed:195});
  g.player.x=z.x+dir*80;g.player.y=z.y-150;g.update(1/60);assert.equal(z.state,'run');assert.equal(z.dir,-dir);assert.equal(z.tauntExit,undefined);
 }
});
test('committed dives, escaped targets and captured targets do not reverse or respawn',()=>{
 for(const state of ['escaping','escaped','hooked','caught','delivered']){
  const {g,z}=setup();Object.assign(z,{state,escapeStartY:z.y,timer:0});g.player.x=z.x+120;g.player.y=z.y;g.update(1/60);assert.equal(z.dir,1);assert.notEqual(z.state,'run');
 }
});
