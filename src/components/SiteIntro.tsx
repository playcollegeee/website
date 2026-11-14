// 進站 LOGO 動畫：每次開瀏覽器第一次進官網時，原始 LOGO 的零件從四周飛進來組成學院圖示，再往上收起。
// 零件與位置沿用登入頁「學院圖示打開」（public/brand/parts，原始 LOGO 切出來的）。
// 動畫全部用 CSS，內嵌的小程式只負責決定要不要播：同一次瀏覽已播過、或使用者開了「減少動態效果」就不播。
// 點一下可以直接略過。
const script = `(function(){try{var d=document.documentElement,s=sessionStorage;
if(s.getItem("pc_intro")||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
s.setItem("pc_intro","1");d.classList.add("intro-on");
var off=function(){d.classList.remove("intro-on")};
setTimeout(off,2600);
addEventListener("pointerdown",off,{once:true});addEventListener("keydown",off,{once:true});
}catch(e){}})();`;

const parts = ["roof", "p1", "p2", "cap", "box", "base"];

export default function SiteIntro() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: script }} />
      <div className="intro" aria-hidden="true">
        <div className="intro-icon">
          {parts.map((k) => (
            <img key={k} src={`/brand/parts/${k}.png`} alt="" className={`d-${k} in-${k}`} />
          ))}
        </div>
      </div>
    </>
  );
}
