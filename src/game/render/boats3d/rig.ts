/** Такелаж: мачты, паруса, ванты — общие для парусных судов */
import * as THREE from 'three';
import { Cloth, V3, cyl, quadPoint, strut, texSail, type Builder, mesh } from './kit';

export function sailMesh(b: Builder, color: string, cross = true) {
  const mat = new THREE.MeshStandardMaterial({ map: texSail(color, cross), roughness: 0.92, side: THREE.DoubleSide });
  const cloth = new Cloth(14, 18, mat);
  b.add(cloth.mesh);
  return {
    mesh: cloth.mesh,
    /**
     * tl/tr — верхняя кромка (шкаторина у мачты / пик), bl/br — нижняя (галс / шкотовый угол).
     * n — горизонтальная нормаль паруса, bulge — пузо, flutter — трепет
     */
    set(tl: V3, tr: V3, bl: V3, br: V3, n: V3, bulge: number, flutter: number, t: number) {
      cloth.set((u, v, o) => {
        quadPoint(tl, tr, bl, br, u, v, o);
        const camber = Math.sin(Math.PI * Math.pow(u, 0.8)) * (1 - 0.35 * v);
        const fl = flutter * Math.sin(t * 9 + u * 9 + v * 5) * Math.min(1, u * 2) * (0.4 + 0.6 * (1 - v));
        const k = bulge * camber + fl;
        o.x += n.x * k;
        o.y += n.y * k;
        o.z += n.z * k;
      });
    },
  };
}

/** Конусная мачта */
export function mast(b: Builder, s: number, y0: number, h: number, rBot: number, rTop: number, mat: THREE.Material) {
  const m = mesh(new THREE.CylinderGeometry(rTop, rBot, h, 12), mat, s, y0 + h / 2, 0);
  b.add(m);
  b.height(y0 + h);
  return m;
}

/** Тонкая снасть между двумя точками (в системе корпуса) */
export function line(b: Builder, a: V3, c: V3, r: number, mat: THREE.Material) {
  return b.add(strut(a, c, r, mat));
}

/** Краспица: поперечная распорка мачты */
export function spreader(b: Builder, s: number, y: number, len: number, mat: THREE.Material) {
  for (const side of [-1, 1]) {
    const c = cyl(0.018, 0.018, len, mat, s, y, side * len * 0.5, 6);
    c.rotation.x = Math.PI / 2;
    b.add(c);
  }
}
