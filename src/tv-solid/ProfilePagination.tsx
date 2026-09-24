/** @jsxImportSource @solidtv/solid */
import { defineScreen, TvText, TvView } from "./runtime";
import { tokens } from "../theme/viptv-tokens.generated";
import { noteFocus } from "./focusDebug";

export const ProfilePageButton = defineScreen({
  props: ["step", "page", "pages"] as unknown as {step:number;page:number;pages:number},
  state() {return {focused:false};},
  hooks: {
    focus() {this.focused=true;noteFocus("profile-page",this.step<0?0:1);},
    unfocus() {this.focused=false;},
  },
  input: {
    left() {this.$emit("profile-page-move",-1);},
    right() {this.$emit("profile-page-move",1);},
    up() {this.$emit("profile-restore-focus");},
    down() {this.$emit("profile-page-manage");},
    enter() {return ()=>{
      if(this.page+this.step>=0&&this.page+this.step<this.pages)this.$emit("profile-page-change",this.step);
    };},
  },
  render:s=><TvView x={s.step<0?720:1026} y={695} w={s.step<0?210:174} h={52}
    alpha={s.page+s.step<0||s.page+s.step>=s.pages?0.45:1}>
    <TvView x={-4} y={-4} w={s.step<0?218:182} h={60} rounded={30} color={tokens["color.fill.white"]} show={s.focused}/>
    <TvView w={s.step<0?210:174} h={52} rounded={26} color={s.focused?tokens["color.text.primary"]:tokens["color.fill.tv-unfocused"]}/>
    <TvText x={0} y={13} maxwidth={s.step<0?210:174} align="center" size={22} font="Onest600"
      content={s.step<0?"‹  Previous":"Next  ›"} color={s.focused?tokens["color.on.light"]:tokens["color.text.primary"]}/>
  </TvView>,
});
