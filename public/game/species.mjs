// A target keeps its species throughout emergence, escape and airborne recovery.
export const SPECIES = Object.freeze({
 basic: Object.freeze({name:'普通型',speed:230,hits:2,height:118,bodyHeight:110,halfWidth:23,cycle:150,description:'直线逃跑 · 普通命中两次捕获'}),
 hopper: Object.freeze({name:'长耳跳跃型',speed:310,hits:2,height:145,bodyHeight:112,halfWidth:27,cycle:174,description:'高速蹬跳 · 普通命中两次捕获'}),
 bird: Object.freeze({name:'圆鸟型',speed:270,hits:3,height:112,bodyHeight:104,halfWidth:29,cycle:144,description:'升空飞逃 · 普通命中三次捕获'}),
 shell: Object.freeze({name:'矮壮甲壳型',speed:178,hits:5,height:96,bodyHeight:86,halfWidth:42,cycle:138,description:'稳步逃跑 · 普通命中五次捕获'}),
 longbody: Object.freeze({name:'长身短腿型',speed:278,hits:4,height:97,bodyHeight:88,halfWidth:46,cycle:175,description:'贴地窜行 · 普通命中四次捕获'}),
});
export const ENCOUNTER_SPECIES = Object.freeze(['basic','hopper','bird','shell','longbody','hopper','shell','longbody']);
export const speciesFor = z => SPECIES[z?.species] || SPECIES.basic;
export const capturePoint = z => ({x:z.x,y:z.y-speciesFor(z).bodyHeight*.58});

// Fast bursts alternate with a catchable recovery, while escape direction stays fixed.
export function escapeSpeed(z){const s=speciesFor(z);return s.speed*(z.species==='hopper'?(z.timer%1.6<.48?1.2:.9):1);}
export function birdFlightHeight(t){return 92+24*Math.sin(t*2.4);}
