// The original-video review plays once. Gameplay uses a moving full-body laugh cycle with the same audio window.
export const TAUNT_DURATION=1.6;
export const TAUNT_AUDIO_OFFSET=.9;
export function tauntFrame(elapsed,count,duration=TAUNT_DURATION){
 return Math.min(count-1,Math.floor(Math.max(0,Number(elapsed)||0)/duration*count));
}

export const TAUNT_APPROACH=180;
export const ESCAPE_JUMP_DURATION=.62;
export function escapeJumpOffset(t){const q=Math.max(0,Math.min(1,t/ESCAPE_JUMP_DURATION));return -75*Math.sin(Math.PI*q)+135*q*q;}
