// ONNX Runtime declares its original package name even when installed via an npm alias.
// Load the alias package's ambient `onnxruntime-web/*` declarations and re-export them.
/// <reference path="../../../../node_modules/ardy-onnxruntime-web/types.d.ts" />
declare module 'ardy-onnxruntime-web/webgpu' {
  export * from 'onnxruntime-web/webgpu';
}
