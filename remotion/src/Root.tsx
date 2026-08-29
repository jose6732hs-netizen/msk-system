import React from "react";
import { Composition } from "remotion";
import { MainVideo, TOTAL } from "./MainVideo";
import { SalesVideo, SALES_TOTAL } from "./SalesVideo";
import { VsVideo, VS_TOTAL } from "./VsVideo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="main" component={MainVideo} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="sales" component={SalesVideo} durationInFrames={SALES_TOTAL} fps={30} width={1080} height={1920} />
    <Composition id="vs" component={VsVideo} durationInFrames={VS_TOTAL} fps={30} width={1080} height={1920} />
  </>
);
