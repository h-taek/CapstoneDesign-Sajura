// 페이지 쪽(MAIN world) 진입점 — manifest content_scripts의 world: MAIN, document_start.
import { installDialogGuard } from "./dialogGuard";

installDialogGuard(window);
