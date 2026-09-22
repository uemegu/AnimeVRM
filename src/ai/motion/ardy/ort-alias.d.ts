// ONNX Runtime declares its original package name even when installed via an npm alias.
// The browser API used here is shared with the viewer's existing ORT dependency.
declare module 'ardy-onnxruntime-web/webgpu' {
  export * from 'onnxruntime-web/webgpu';
}
