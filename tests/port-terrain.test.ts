import test from "node:test";
import assert from "node:assert/strict";
import { berthScale, coralHillY, groundedFoot, hillY, miradorHillY, quadraticGroundY } from "../src/game/render/portTerrain";

const sizes = [[320, 568], [390, 844], [844, 390], [1440, 900], [2560, 1440]];

test("terrain lookup inverts the actual Bézier rather than an approximate parabola", () => {
  for (const [W, H] of sizes) for (const t of [0, .01, .1, .3, .5, .7, .9, .99, 1]) {
    const h = H * .5;
    for (const [x0, y0, x1, y1, x2, y2] of [
      [.4*W,h+2,.72*W,h-.26*H,1.05*W,h-.05*H],
      [.5*W,h+2,.72*W,h-.14*H,.9*W,h-.06*H],
      [.9*W,h-.06*H,.96*W,h-.03*H,1.02*W,h-.08*H],
    ]) {
      const x = (1-t)**2*x0 + 2*(1-t)*t*x1 + t*t*x2;
      const y = (1-t)**2*y0 + 2*(1-t)*t*y1 + t*t*y2;
      assert.ok(Math.abs(quadraticGroundY(x,x0,y0,x1,y1,x2,y2)-y) < 1e-8);
    }
  }
});

test("village foundations remain grounded across their complete footprint on narrow and wide screens", () => {
  for (const [W,H] of sizes) {
    const horizon=H*.5, sc=Math.min(W/1100,H/700);
    for (const surface of [
      (x:number)=>hillY(x,W*.82,W*.42,H*.2,horizon),
      (x:number)=>hillY(x,W*.12,W*.34,H*.13,horizon),
      (x:number)=>miradorHillY(W,H,horizon,x),
    ]) for (const q of [.52,.58,.62,.645,.66,.71,.74,.775,.8,.84,.9,.96]) {
      const x=W*q, half=22*sc, foot=groundedFoot(surface,x,half,2*sc);
      for (let i=0;i<=100;i++) assert.ok(foot >= surface(x-half+2*half*i/100)-.05);
    }
  }
});

test("the second tropical ridge segment keeps its palms on land, not in open water", () => {
  for (const [W,H] of sizes) {
    const h=H*.5;
    for(let i=0;i<9;i++) assert.ok(coralHillY(W,H,h,W*(.52+i*.055)) < h);
    const left=coralHillY(W,H,h,W*.9-1e-7),right=coralHillY(W,H,h,W*.9+1e-7);
    assert.ok(Math.abs(left-right)<1e-5);
  }
});

test("large vessels fit their reserved berth without covering other moored boats", () => {
  for (const [W,H] of sizes) for (const dock of [.66,.68,.7]) for(const width of [5.26,5.65,7.05,8.07,8.8,9.55,11.5,12.7,13.9]) {
    const sc=Math.max(.5,Math.min(1.3,H/820,W/760)), x=W*dock+40*sc;
    const naturalWidth=width*28*1.08, scale=berthScale(W,x,sc*.9,naturalWidth);
    assert.ok(scale>0 && scale<=sc*.9);
    assert.ok(x-naturalWidth*scale/2>=W*.55-1e-8);
    assert.ok(x+naturalWidth*scale/2<=W-12+1e-8);
  }
});
