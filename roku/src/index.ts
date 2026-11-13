import './compiled-components/BaseAppScene.xml';
import './compiled-components/WorkerTask.xml';
import './compiled-components/ViptvTextDialogBridge.xml';
import './compiled-components/SolidMotionGroup.xml';
import { main, registerAnchorNode, enableExceptionTagging } from '@roku-sdk/rsg-ts';
import Probe from './components/my-first-app';
main(() => { enableExceptionTagging(); console.log('SOLIDTV_PROBE boot'); registerAnchorNode(Probe); });
