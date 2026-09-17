(module
 (type $0 (func (param f64) (result f64)))
 (type $1 (func))
 (type $2 (func (param f32) (result f32)))
 (type $3 (func (param f32)))
 (type $4 (func (param i32)))
 (type $5 (func (param i32 i32) (result f32)))
 (type $6 (func (param i64) (result i32)))
 (type $7 (func (param i32 i32 i32 i32)))
 (import "env" "abort" (func $~lib/builtins/abort (param i32 i32 i32 i32)))
 (global $assembly/index/INPUT_OFFSET i32 (i32.const 32768))
 (global $assembly/index/DISTANCES_OFFSET i32 (i32.const 53404))
 (global $assembly/index/STATS_OFFSET i32 (i32.const 53424))
 (global $assembly/index/currentPhoneme (mut i32) (i32.const -1))
 (global $assembly/index/isVoicing (mut i32) (i32.const 0))
 (global $assembly/index/silenceHoldCounter (mut i32) (i32.const 0))
 (global $assembly/index/holdFrames (mut i32) (i32.const 12))
 (global $assembly/index/rmsThreshold (mut f32) (f32.const 0.00800000037997961))
 (global $assembly/index/smoothedRms (mut f32) (f32.const 0))
 (global $assembly/index/voiceGender (mut i32) (i32.const 0))
 (global $assembly/index/sampleRate (mut f32) (f32.const 44100))
 (global $assembly/index/initialized (mut i32) (i32.const 0))
 (global $~lib/math/rempio2_y0 (mut f64) (f64.const 0))
 (global $~lib/math/rempio2_y1 (mut f64) (f64.const 0))
 (global $~lib/math/res128_hi (mut i64) (i64.const 0))
 (memory $0 2)
 (data $0 (i32.const 1036) "\0c\01")
 (data $0.1 (i32.const 1048) "\04\00\00\00\f0\00\00\00ff Bff\8a\c1\cd\cc\d0\c1\00\00\cc\c1ff\ce\c1\cd\cc\cc\be\00\00\f8A\00\00`A\9a\99\9d\c1ff\82\c133\f3?\cd\ccL\bf33\fbA\cd\cc\f0\c133\0b\c133\b3\bf\00\00\9c\c1\cd\cc\f8\c133\d3\c0ff\86\c033\f3\c0\9a\99\d9\bf\9a\99\d9?fff\bf\00\00\e8A\9a\99\11\c1ff\06B\00\00\f0A33\9b\c1\9a\99\cd\c133[\c1\cd\cc\a8\c1\9a\99\a5\c1\cd\cc\b0\c1\00\00\cc\c1\cd\cc\0c\c1\cd\cc(B\00\00\00\c0\cd\cc\a0\c1\cd\cc\ec\c133\fb\c1ff>\c1ffNA\00\00\b0@\9a\99Q\c1\9a\99!\c1\9a\999@\00\00\b0@\9a\99WB\00\00\e4A\9a\99IA\00\00X\c1\00\00 \c1\00\00\b0\c0\9a\99\85\c133\d3\c1ff\ea\c1\00\00\b4\c1ff\1e\c1\cd\cc\cc@")
 (data $1 (i32.const 1308) "\0c\01")
 (data $1.1 (i32.const 1320) "\04\00\00\00\f0\00\00\00\cd\cc\a3Bff\e6A\cd\cc\8c?33\a3\c0\cd\ccd\c133\97\c1\cd\ccL\be\9a\99\c9A\9a\99\c9A\cd\cc\9c@\00\00\b0\c0333?33_B\9a\999A\cd\cclA\9a\99\01Bff\1eB33\83A\cd\ccl\c1\cd\cc\\\c1\00\00\00\c1\9a\99\f9\c0fff@\cd\cc\8c@ff:Bff\a6?\00\00\90@\9a\99!B\00\00<B\9a\991Aff\92\c1\9a\99!\c1\00\00\08A33\e3@33\e3\c0\9a\99Y\c1\00\00\89Bff\10B\9a\99\9dA33s@ff\8a\c1\00\00\f4\c1\9a\99\d9\c1\00\00\08\c1\00\00\b0@\00\00\00?\00\00\90\c0\00\00 @\9a\99aB\cd\cc\00B33\a3A\cd\cc\bcA\cd\cc\dcA\cd\cc\a8A\9a\99\e9@33\a3\c0ffF\c1\9a\99Y\c1ff\0e\c1\9a\99Y\c0")
 (data $2 (i32.const 1580) "l")
 (data $2.1 (i32.const 1592) "\04\00\00\00P\00\00\00\00\80;D\00\00\96D\00\80\a2D\00\c0\daD\00\00\c8C\00\00*D\00\00\faD\00@5E\00\00\82C\00\00\e1C\00@\1cE\00\00aE\00\00\e1C\00\80;D\00\00aD\00\80\bbD\00\00\8cC\00\00\faC\00\00aD\00\00\c8D")
 (data $3 (i32.const 1692) "l")
 (data $3.1 (i32.const 1704) "\04\00\00\00P\00\00\00\00\00\16D\00\80mD\00@\83D\00\c0\c1D\00\00\afC\00\00\11D\00\80\d4D\00@\1cE\00\00HC\00\00\beC\00\00\faD\00\80;E\00\00\beC\00\00\1bD\00\80;D\00@\9cD\00\00\\C\00\00\d2C\00\80;D\00\80\a2D")
 (data $4 (i32.const 1808) "n\83\f9\a2\00\00\00\00\d1W\'\fc)\15DN\99\95b\db\c0\dd4\f5\abcQ\feA\90C<:n$\b7a\c5\bb\de\ea.I\06\e0\d2MB\1c\eb\1d\fe\1c\92\d1\t\f55\82\e8>\a7)\b1&p\9c\e9\84D\bb.9\d6\919A~_\b4\8b_\84\9c\f49S\83\ff\97\f8\1f;(\f9\bd\8b\11/\ef\0f\98\05\de\cf~6m\1fm\nZf?FO\b7\t\cb\'\c7\ba\'u-\ea_\9e\f79\07={\f1\e5\eb\b1_\fbk\ea\92R\8aF0\03V\08]\8d\1f \bc\cf\f0\abk{\fca\91\e3\a9\1d6\f4\9a_\85\99e\08\1b\e6^\80\d8\ff\8d@h\a0\14W\15\06\061\'sM")
 (data $5 (i32.const 2012) "<")
 (data $5.1 (i32.const 2024) "\02\00\00\00$\00\00\00I\00n\00d\00e\00x\00 \00o\00u\00t\00 \00o\00f\00 \00r\00a\00n\00g\00e")
 (data $6 (i32.const 2076) "<")
 (data $6.1 (i32.const 2088) "\02\00\00\00&\00\00\00~\00l\00i\00b\00/\00s\00t\00a\00t\00i\00c\00a\00r\00r\00a\00y\00.\00t\00s")
 (export "INPUT_OFFSET" (global $assembly/index/INPUT_OFFSET))
 (export "DISTANCES_OFFSET" (global $assembly/index/DISTANCES_OFFSET))
 (export "STATS_OFFSET" (global $assembly/index/STATS_OFFSET))
 (export "init" (func $assembly/index/init))
 (export "setVoiceGender" (func $assembly/index/setVoiceGender))
 (export "setRmsThreshold" (func $assembly/index/setRmsThreshold))
 (export "setHoldFrames" (func $assembly/index/setHoldFrames))
 (export "resetState" (func $assembly/index/resetState))
 (export "processFrame" (func $assembly/index/processFrame))
 (export "memory" (memory $0))
 (func $~lib/math/NativeMath.round (param $0 f64) (result f64)
  local.get $0
  f64.ceil
  local.get $0
  f64.ceil
  f64.const -0.5
  f64.add
  local.get $0
  f64.gt
  f64.convert_i32_u
  f64.sub
 )
 (func $~lib/staticarray/StaticArray<f32>#__get (param $0 i32) (param $1 i32) (result f32)
  local.get $1
  local.get $0
  i32.const 20
  i32.sub
  i32.load offset=16
  i32.const 2
  i32.shr_u
  i32.ge_u
  if
   i32.const 2032
   i32.const 2096
   i32.const 78
   i32.const 41
   call $~lib/builtins/abort
   unreachable
  end
  local.get $0
  local.get $1
  i32.const 2
  i32.shl
  i32.add
  f32.load
 )
 (func $~lib/math/NativeMath.cos (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 f64)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (local $6 f64)
  (local $7 f64)
  (local $8 f64)
  local.get $0
  i64.reinterpret_f64
  local.tee $4
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $3
  i32.const 31
  i32.shr_u
  local.set $5
  local.get $3
  i32.const 2147483647
  i32.and
  local.tee $3
  i32.const 1072243195
  i32.le_u
  if
   local.get $3
   i32.const 1044816030
   i32.lt_u
   if
    f64.const 1
    return
   end
   local.get $0
   local.get $0
   f64.mul
   local.tee $1
   local.get $1
   f64.mul
   local.set $2
   f64.const 1
   local.get $1
   f64.const 0.5
   f64.mul
   local.tee $6
   f64.sub
   local.tee $7
   f64.const 1
   local.get $7
   f64.sub
   local.get $6
   f64.sub
   local.get $1
   local.get $1
   local.get $1
   local.get $1
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $2
   local.get $2
   f64.mul
   local.get $1
   local.get $1
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $0
   f64.const 0
   f64.mul
   f64.sub
   f64.add
   f64.add
   return
  end
  local.get $3
  i32.const 2146435072
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.0 (result i32)
   local.get $4
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.tee $3
   i32.const 1094263291
   i32.lt_u
   if
    local.get $3
    i32.const 20
    i32.shr_u
    local.tee $3
    local.get $0
    local.get $0
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.tee $6
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.tee $0
    local.get $6
    f64.const 6.077100506506192e-11
    f64.mul
    local.tee $2
    f64.sub
    local.tee $1
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    i32.const 16
    i32.gt_u
    if
     local.get $6
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $0
     local.get $0
     local.get $6
     f64.const 6.077100506303966e-11
     f64.mul
     local.tee $1
     f64.sub
     local.tee $0
     f64.sub
     local.get $1
     f64.sub
     f64.sub
     local.set $2
     local.get $3
     local.get $0
     local.get $2
     f64.sub
     local.tee $1
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     i32.const 49
     i32.gt_u
     if
      local.get $6
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $0
      local.get $0
      local.get $6
      f64.const 2.0222662487111665e-21
      f64.mul
      local.tee $1
      f64.sub
      local.tee $0
      f64.sub
      local.get $1
      f64.sub
      f64.sub
      local.set $2
      local.get $0
      local.get $2
      f64.sub
      local.set $1
     end
    end
    local.get $1
    global.set $~lib/math/rempio2_y0
    local.get $0
    local.get $1
    f64.sub
    local.get $2
    f64.sub
    global.set $~lib/math/rempio2_y1
    local.get $6
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.0
   end
   i32.const 0
   local.get $4
   call $~lib/math/pio2_large_quot
   local.tee $3
   i32.sub
   local.get $3
   local.get $5
   select
  end
  local.set $3
  global.get $~lib/math/rempio2_y0
  local.set $1
  global.get $~lib/math/rempio2_y1
  local.set $2
  local.get $3
  i32.const 1
  i32.and
  if (result f64)
   local.get $1
   local.get $1
   f64.mul
   local.tee $0
   local.get $1
   f64.mul
   local.set $6
   local.get $1
   local.get $0
   local.get $2
   f64.const 0.5
   f64.mul
   local.get $6
   local.get $0
   local.get $0
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   f64.mul
   local.get $0
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.sub
   f64.mul
   local.get $2
   f64.sub
   local.get $6
   f64.const -0.16666666666666632
   f64.mul
   f64.sub
   f64.sub
  else
   local.get $1
   local.get $1
   f64.mul
   local.tee $6
   local.get $6
   f64.mul
   local.set $7
   f64.const 1
   local.get $6
   f64.const 0.5
   f64.mul
   local.tee $0
   f64.sub
   local.tee $8
   f64.const 1
   local.get $8
   f64.sub
   local.get $0
   f64.sub
   local.get $6
   local.get $6
   local.get $6
   local.get $6
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $7
   local.get $7
   f64.mul
   local.get $6
   local.get $6
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $1
   local.get $2
   f64.mul
   f64.sub
   f64.add
   f64.add
  end
  local.tee $0
  f64.neg
  local.get $0
  local.get $3
  i32.const 1
  i32.add
  i32.const 2
  i32.and
  select
 )
 (func $assembly/index/melToHz (param $0 f32) (result f32)
  local.get $0
  f32.const 1125
  f32.div
  f64.promote_f32
  call $~lib/math/NativeMath.exp
  f32.demote_f64
  f32.const -1
  f32.add
  f32.const 700
  f32.mul
 )
 (func $~lib/math/pio2_large_quot (param $0 i64) (result i32)
  (local $1 i64)
  (local $2 i64)
  (local $3 i64)
  (local $4 i32)
  (local $5 f64)
  (local $6 i64)
  (local $7 i64)
  (local $8 i64)
  (local $9 i64)
  (local $10 i64)
  (local $11 i64)
  (local $12 i64)
  local.get $0
  i64.const 9223372036854775807
  i64.and
  i64.const 52
  i64.shr_u
  i64.const 1045
  i64.sub
  local.tee $1
  i64.const 63
  i64.and
  local.set $6
  local.get $1
  i64.const 6
  i64.shr_s
  i32.wrap_i64
  i32.const 3
  i32.shl
  i32.const 1808
  i32.add
  local.tee $4
  i64.load
  local.set $3
  local.get $4
  i64.load offset=8
  local.set $2
  local.get $4
  i64.load offset=16
  local.set $1
  local.get $6
  i64.const 0
  i64.ne
  if
   local.get $3
   local.get $6
   i64.shl
   local.get $2
   i64.const 64
   local.get $6
   i64.sub
   local.tee $7
   i64.shr_u
   i64.or
   local.set $3
   local.get $2
   local.get $6
   i64.shl
   local.get $1
   local.get $7
   i64.shr_u
   i64.or
   local.set $2
   local.get $1
   local.get $6
   i64.shl
   local.get $4
   i64.load offset=24
   local.get $7
   i64.shr_u
   i64.or
   local.set $1
  end
  local.get $0
  i64.const 4503599627370495
  i64.and
  i64.const 4503599627370496
  i64.or
  local.tee $6
  i64.const 4294967295
  i64.and
  local.set $7
  local.get $6
  i64.const 32
  i64.shr_u
  local.tee $8
  local.get $2
  i64.const 4294967295
  i64.and
  local.tee $9
  i64.mul
  local.get $2
  i64.const 32
  i64.shr_u
  local.tee $2
  local.get $7
  i64.mul
  local.get $7
  local.get $9
  i64.mul
  local.tee $7
  i64.const 32
  i64.shr_u
  i64.add
  local.tee $9
  i64.const 4294967295
  i64.and
  i64.add
  local.set $10
  local.get $2
  local.get $8
  i64.mul
  local.get $9
  i64.const 32
  i64.shr_u
  i64.add
  local.get $10
  i64.const 32
  i64.shr_u
  i64.add
  global.set $~lib/math/res128_hi
  local.get $8
  local.get $1
  i64.const 32
  i64.shr_u
  i64.mul
  local.tee $1
  local.get $7
  i64.const 4294967295
  i64.and
  local.get $10
  i64.const 32
  i64.shl
  i64.add
  i64.add
  local.tee $2
  local.get $1
  i64.lt_u
  i64.extend_i32_u
  global.get $~lib/math/res128_hi
  local.get $3
  local.get $6
  i64.mul
  i64.add
  i64.add
  local.tee $3
  i64.const 2
  i64.shl
  local.get $2
  i64.const 62
  i64.shr_u
  i64.or
  local.tee $6
  i64.const 63
  i64.shr_s
  local.tee $7
  local.get $2
  i64.const 2
  i64.shl
  i64.xor
  local.set $8
  local.get $6
  local.get $7
  i64.const 1
  i64.shr_s
  i64.xor
  local.tee $1
  i64.clz
  local.set $9
  local.get $1
  local.get $9
  i64.shl
  local.get $8
  i64.const 64
  local.get $9
  i64.sub
  i64.shr_u
  i64.or
  local.tee $10
  i64.const 4294967295
  i64.and
  local.set $2
  local.get $10
  i64.const 32
  i64.shr_u
  local.tee $1
  i64.const 560513588
  i64.mul
  local.get $2
  i64.const 3373259426
  i64.mul
  local.get $2
  i64.const 560513588
  i64.mul
  local.tee $11
  i64.const 32
  i64.shr_u
  i64.add
  local.tee $2
  i64.const 4294967295
  i64.and
  i64.add
  local.set $12
  local.get $1
  i64.const 3373259426
  i64.mul
  local.get $2
  i64.const 32
  i64.shr_u
  i64.add
  local.get $12
  i64.const 32
  i64.shr_u
  i64.add
  global.set $~lib/math/res128_hi
  local.get $10
  f64.convert_i64_u
  f64.const 3.753184150245214e-04
  f64.mul
  local.get $8
  local.get $9
  i64.shl
  f64.convert_i64_u
  f64.const 3.834951969714103e-04
  f64.mul
  f64.add
  i64.trunc_sat_f64_u
  local.tee $1
  local.get $11
  i64.const 4294967295
  i64.and
  local.get $12
  i64.const 32
  i64.shl
  i64.add
  local.tee $2
  i64.gt_u
  i64.extend_i32_u
  global.get $~lib/math/res128_hi
  local.tee $8
  i64.const 11
  i64.shr_u
  i64.add
  f64.convert_i64_u
  global.set $~lib/math/rempio2_y0
  local.get $8
  i64.const 53
  i64.shl
  local.get $2
  i64.const 11
  i64.shr_u
  i64.or
  local.get $1
  i64.add
  f64.convert_i64_u
  f64.const 5.421010862427522e-20
  f64.mul
  global.set $~lib/math/rempio2_y1
  global.get $~lib/math/rempio2_y0
  i64.const 4372995238176751616
  local.get $9
  i64.const 52
  i64.shl
  i64.sub
  local.get $0
  local.get $6
  i64.xor
  i64.const -9223372036854775808
  i64.and
  i64.or
  f64.reinterpret_i64
  local.tee $5
  f64.mul
  global.set $~lib/math/rempio2_y0
  global.get $~lib/math/rempio2_y1
  local.get $5
  f64.mul
  global.set $~lib/math/rempio2_y1
  local.get $3
  i64.const 62
  i64.shr_s
  local.get $7
  i64.sub
  i32.wrap_i64
 )
 (func $~lib/math/NativeMath.log (param $0 f64) (result f64)
  (local $1 i32)
  (local $2 i64)
  (local $3 i32)
  (local $4 f64)
  (local $5 i32)
  (local $6 f64)
  (local $7 f64)
  (local $8 f64)
  local.get $0
  i64.reinterpret_f64
  local.tee $2
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $1
  i32.const 31
  i32.shr_u
  local.tee $3
  local.get $1
  i32.const 1048576
  i32.lt_u
  i32.or
  if
   local.get $2
   i64.const 1
   i64.shl
   i64.eqz
   if
    f64.const -1
    local.get $0
    local.get $0
    f64.mul
    f64.div
    return
   end
   local.get $3
   if
    local.get $0
    local.get $0
    f64.sub
    f64.const 0
    f64.div
    return
   end
   i32.const -54
   local.set $5
   local.get $0
   f64.const 18014398509481984
   f64.mul
   i64.reinterpret_f64
   local.tee $2
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   local.set $1
  else
   local.get $1
   i32.const 2146435072
   i32.ge_u
   if
    local.get $0
    return
   else
    local.get $2
    i64.const 32
    i64.shl
    i64.eqz
    local.get $1
    i32.const 1072693248
    i32.eq
    i32.and
    if
     f64.const 0
     return
    end
   end
  end
  local.get $2
  i64.const 4294967295
  i64.and
  local.get $1
  i32.const 614242
  i32.add
  local.tee $1
  i32.const 1048575
  i32.and
  i32.const 1072079006
  i32.add
  i64.extend_i32_u
  i64.const 32
  i64.shl
  i64.or
  f64.reinterpret_i64
  f64.const -1
  f64.add
  local.tee $7
  f64.const 0.5
  f64.mul
  local.get $7
  f64.mul
  local.set $0
  local.get $7
  local.get $7
  f64.const 2
  f64.add
  f64.div
  local.tee $8
  local.get $8
  f64.mul
  local.tee $4
  local.get $4
  f64.mul
  local.set $6
  local.get $8
  local.get $0
  local.get $4
  local.get $6
  local.get $6
  local.get $6
  f64.const 0.14798198605116586
  f64.mul
  f64.const 0.1818357216161805
  f64.add
  f64.mul
  f64.const 0.2857142874366239
  f64.add
  f64.mul
  f64.const 0.6666666666666735
  f64.add
  f64.mul
  local.get $6
  local.get $6
  local.get $6
  f64.const 0.15313837699209373
  f64.mul
  f64.const 0.22222198432149784
  f64.add
  f64.mul
  f64.const 0.3999999999940942
  f64.add
  f64.mul
  f64.add
  f64.add
  f64.mul
  local.get $5
  local.get $1
  i32.const 20
  i32.shr_s
  i32.const 1023
  i32.sub
  i32.add
  f64.convert_i32_s
  local.tee $4
  f64.const 1.9082149292705877e-10
  f64.mul
  f64.add
  local.get $0
  f64.sub
  local.get $7
  f64.add
  local.get $4
  f64.const 0.6931471803691238
  f64.mul
  f64.add
 )
 (func $assembly/index/init (param $0 f32)
  (local $1 i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 f64)
  (local $6 f32)
  local.get $0
  global.set $assembly/index/sampleRate
  loop $for-loop|0
   local.get $1
   i32.const 1024
   i32.lt_s
   if
    local.get $1
    i32.const 2
    i32.shl
    i32.const 54000
    i32.add
    f64.const 0.5400000214576721
    local.get $1
    f64.convert_i32_s
    f64.const 6.283185307179586
    f64.mul
    f64.const 1023
    f64.div
    call $~lib/math/NativeMath.cos
    f64.const 0.46000000834465027
    f64.mul
    f64.sub
    f32.demote_f64
    f32.store
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|0
   end
  end
  i32.const 0
  local.set $1
  loop $for-loop|1
   local.get $1
   i32.const 1024
   i32.lt_s
   if
    i32.const 0
    local.set $3
    local.get $1
    local.set $2
    i32.const 0
    local.set $4
    loop $for-loop|2
     local.get $4
     i32.const 10
     i32.lt_s
     if
      local.get $2
      i32.const 1
      i32.and
      local.get $3
      i32.const 1
      i32.shl
      i32.or
      local.set $3
      local.get $2
      i32.const 1
      i32.shr_s
      local.set $2
      local.get $4
      i32.const 1
      i32.add
      local.set $4
      br $for-loop|2
     end
    end
    local.get $1
    i32.const 2
    i32.shl
    i32.const 58100
    i32.add
    local.get $3
    i32.store
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|1
   end
  end
  i32.const 0
  local.set $1
  loop $for-loop|3
   local.get $1
   i32.const 512
   i32.lt_s
   if
    local.get $1
    i32.const 2
    i32.shl
    local.tee $2
    i32.const 62200
    i32.add
    local.get $1
    f64.convert_i32_s
    f64.const -6.283185307179586
    f64.mul
    f64.const 0.0009765625
    f64.mul
    local.tee $5
    call $~lib/math/NativeMath.cos
    f32.demote_f64
    f32.store
    local.get $2
    i32.const 64248
    i32.add
    local.get $5
    call $~lib/math/NativeMath.sin
    f32.demote_f64
    f32.store
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|3
   end
  end
  global.get $assembly/index/sampleRate
  f32.const 0.5
  f32.mul
  call $assembly/index/hzToMel
  f32.const 0
  call $assembly/index/hzToMel
  local.tee $0
  f32.sub
  f32.const 27
  f32.div
  local.set $6
  i32.const 0
  local.set $1
  loop $for-loop|4
   local.get $1
   i32.const 26
   i32.lt_s
   if
    local.get $1
    i32.const 2
    i32.shl
    local.tee $3
    i32.const 66296
    i32.add
    local.get $0
    local.get $1
    f32.convert_i32_s
    local.get $6
    f32.mul
    f32.add
    call $assembly/index/melToHz
    f32.const 1025
    f32.mul
    global.get $assembly/index/sampleRate
    f32.div
    f64.promote_f32
    f64.floor
    i32.trunc_sat_f64_s
    i32.store
    local.get $3
    i32.const 66400
    i32.add
    local.get $0
    local.get $1
    i32.const 1
    i32.add
    local.tee $2
    f32.convert_i32_s
    local.get $6
    f32.mul
    f32.add
    call $assembly/index/melToHz
    f32.const 1025
    f32.mul
    global.get $assembly/index/sampleRate
    f32.div
    f64.promote_f32
    f64.floor
    i32.trunc_sat_f64_s
    i32.store
    local.get $3
    i32.const 66504
    i32.add
    local.get $0
    local.get $1
    i32.const 2
    i32.add
    f32.convert_i32_s
    local.get $6
    f32.mul
    f32.add
    call $assembly/index/melToHz
    f32.const 1025
    f32.mul
    global.get $assembly/index/sampleRate
    f32.div
    f64.promote_f32
    f64.floor
    i32.trunc_sat_f64_s
    i32.store
    local.get $2
    local.set $1
    br $for-loop|4
   end
  end
  i32.const 0
  local.set $1
  loop $for-loop|5
   local.get $1
   i32.const 13
   i32.lt_s
   if
    i32.const 0
    local.set $2
    loop $for-loop|6
     local.get $2
     i32.const 26
     i32.lt_s
     if
      local.get $1
      i32.const 26
      i32.mul
      local.get $2
      i32.add
      i32.const 2
      i32.shl
      i32.const 66608
      i32.add
      local.get $2
      f64.convert_i32_s
      f64.const 0.5
      f64.add
      f64.const 0.1208304866765305
      f64.mul
      local.get $1
      f64.convert_i32_s
      f64.mul
      call $~lib/math/NativeMath.cos
      f32.demote_f64
      f32.store
      local.get $2
      i32.const 1
      i32.add
      local.set $2
      br $for-loop|6
     end
    end
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|5
   end
  end
  i32.const 1
  global.set $assembly/index/initialized
 )
 (func $assembly/index/hzToMel (param $0 f32) (result f32)
  local.get $0
  f32.const 700
  f32.div
  f64.promote_f32
  f64.const 1
  f64.add
  call $~lib/math/NativeMath.log
  f32.demote_f64
  f32.const 1125
  f32.mul
 )
 (func $~lib/math/NativeMath.sin (param $0 f64) (result f64)
  (local $1 f64)
  (local $2 f64)
  (local $3 i32)
  (local $4 i64)
  (local $5 i32)
  (local $6 f64)
  (local $7 f64)
  (local $8 f64)
  local.get $0
  i64.reinterpret_f64
  local.tee $4
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $3
  i32.const 31
  i32.shr_u
  local.set $5
  local.get $3
  i32.const 2147483647
  i32.and
  local.tee $3
  i32.const 1072243195
  i32.le_u
  if
   local.get $3
   i32.const 1045430272
   i32.lt_u
   if
    local.get $0
    return
   end
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   local.tee $1
   local.get $0
   f64.mul
   local.get $1
   local.get $1
   local.get $1
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $1
   local.get $1
   local.get $1
   f64.mul
   f64.mul
   local.get $1
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.const -0.16666666666666632
   f64.add
   f64.mul
   f64.add
   return
  end
  local.get $3
  i32.const 2146435072
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.sub
   return
  end
  block $~lib/math/rempio2|inlined.1 (result i32)
   local.get $4
   i64.const 32
   i64.shr_u
   i32.wrap_i64
   i32.const 2147483647
   i32.and
   local.tee $3
   i32.const 1094263291
   i32.lt_u
   if
    local.get $3
    i32.const 20
    i32.shr_u
    local.tee $3
    local.get $0
    local.get $0
    f64.const 0.6366197723675814
    f64.mul
    f64.nearest
    local.tee $6
    f64.const 1.5707963267341256
    f64.mul
    f64.sub
    local.tee $0
    local.get $6
    f64.const 6.077100506506192e-11
    f64.mul
    local.tee $2
    f64.sub
    local.tee $1
    i64.reinterpret_f64
    i64.const 32
    i64.shr_u
    i32.wrap_i64
    i32.const 20
    i32.shr_u
    i32.const 2047
    i32.and
    i32.sub
    i32.const 16
    i32.gt_u
    if
     local.get $6
     f64.const 2.0222662487959506e-21
     f64.mul
     local.get $0
     local.get $0
     local.get $6
     f64.const 6.077100506303966e-11
     f64.mul
     local.tee $1
     f64.sub
     local.tee $0
     f64.sub
     local.get $1
     f64.sub
     f64.sub
     local.set $2
     local.get $3
     local.get $0
     local.get $2
     f64.sub
     local.tee $1
     i64.reinterpret_f64
     i64.const 32
     i64.shr_u
     i32.wrap_i64
     i32.const 20
     i32.shr_u
     i32.const 2047
     i32.and
     i32.sub
     i32.const 49
     i32.gt_u
     if
      local.get $6
      f64.const 8.4784276603689e-32
      f64.mul
      local.get $0
      local.get $0
      local.get $6
      f64.const 2.0222662487111665e-21
      f64.mul
      local.tee $1
      f64.sub
      local.tee $0
      f64.sub
      local.get $1
      f64.sub
      f64.sub
      local.set $2
      local.get $0
      local.get $2
      f64.sub
      local.set $1
     end
    end
    local.get $1
    global.set $~lib/math/rempio2_y0
    local.get $0
    local.get $1
    f64.sub
    local.get $2
    f64.sub
    global.set $~lib/math/rempio2_y1
    local.get $6
    i32.trunc_sat_f64_s
    br $~lib/math/rempio2|inlined.1
   end
   i32.const 0
   local.get $4
   call $~lib/math/pio2_large_quot
   local.tee $3
   i32.sub
   local.get $3
   local.get $5
   select
  end
  local.set $3
  global.get $~lib/math/rempio2_y0
  local.set $2
  global.get $~lib/math/rempio2_y1
  local.set $6
  local.get $3
  i32.const 1
  i32.and
  if (result f64)
   local.get $2
   local.get $2
   f64.mul
   local.tee $0
   local.get $0
   f64.mul
   local.set $1
   f64.const 1
   local.get $0
   f64.const 0.5
   f64.mul
   local.tee $7
   f64.sub
   local.tee $8
   f64.const 1
   local.get $8
   f64.sub
   local.get $7
   f64.sub
   local.get $0
   local.get $0
   local.get $0
   local.get $0
   f64.const 2.480158728947673e-05
   f64.mul
   f64.const -0.001388888888887411
   f64.add
   f64.mul
   f64.const 0.0416666666666666
   f64.add
   f64.mul
   local.get $1
   local.get $1
   f64.mul
   local.get $0
   local.get $0
   f64.const -1.1359647557788195e-11
   f64.mul
   f64.const 2.087572321298175e-09
   f64.add
   f64.mul
   f64.const -2.7557314351390663e-07
   f64.add
   f64.mul
   f64.add
   f64.mul
   local.get $2
   local.get $6
   f64.mul
   f64.sub
   f64.add
   f64.add
  else
   local.get $2
   local.get $2
   f64.mul
   local.tee $0
   local.get $2
   f64.mul
   local.set $1
   local.get $2
   local.get $0
   local.get $6
   f64.const 0.5
   f64.mul
   local.get $1
   local.get $0
   local.get $0
   f64.const 2.7557313707070068e-06
   f64.mul
   f64.const -1.984126982985795e-04
   f64.add
   f64.mul
   f64.const 0.00833333333332249
   f64.add
   local.get $0
   local.get $0
   local.get $0
   f64.mul
   f64.mul
   local.get $0
   f64.const 1.58969099521155e-10
   f64.mul
   f64.const -2.5050760253406863e-08
   f64.add
   f64.mul
   f64.add
   f64.mul
   f64.sub
   f64.mul
   local.get $6
   f64.sub
   local.get $1
   f64.const -0.16666666666666632
   f64.mul
   f64.sub
   f64.sub
  end
  local.tee $0
  f64.neg
  local.get $0
  local.get $3
  i32.const 2
  i32.and
  select
 )
 (func $~lib/math/NativeMath.exp (param $0 f64) (result f64)
  (local $1 i32)
  (local $2 f64)
  (local $3 i32)
  (local $4 f64)
  (local $5 i32)
  (local $6 f64)
  (local $7 f64)
  local.get $0
  i64.reinterpret_f64
  i64.const 32
  i64.shr_u
  i32.wrap_i64
  local.tee $1
  i32.const 31
  i32.shr_u
  local.set $5
  local.get $1
  i32.const 2147483647
  i32.and
  local.tee $1
  i32.const 1082532651
  i32.ge_u
  if
   local.get $0
   local.get $0
   f64.ne
   if
    local.get $0
    return
   end
   local.get $0
   f64.const 709.782712893384
   f64.gt
   if
    local.get $0
    f64.const 8988465674311579538646525e283
    f64.mul
    return
   end
   local.get $0
   f64.const -745.1332191019411
   f64.lt
   if
    f64.const 0
    return
   end
  end
  local.get $1
  i32.const 1071001154
  i32.gt_u
  if
   local.get $0
   local.get $0
   f64.const 1.4426950408889634
   f64.mul
   f64.const 0.5
   local.get $0
   f64.copysign
   f64.add
   i32.trunc_sat_f64_s
   i32.const 1
   local.get $5
   i32.const 1
   i32.shl
   i32.sub
   local.get $1
   i32.const 1072734898
   i32.ge_u
   select
   local.tee $3
   f64.convert_i32_s
   f64.const 0.6931471803691238
   f64.mul
   f64.sub
   local.tee $2
   local.get $3
   f64.convert_i32_s
   f64.const 1.9082149292705877e-10
   f64.mul
   local.tee $6
   f64.sub
   local.set $0
  else
   local.get $1
   i32.const 1043333120
   i32.le_u
   if
    local.get $0
    f64.const 1
    f64.add
    return
   end
   local.get $0
   local.set $2
  end
  local.get $0
  local.get $0
  f64.mul
  local.tee $7
  local.get $7
  f64.mul
  local.set $4
  local.get $0
  local.get $0
  local.get $7
  f64.const 0.16666666666666602
  f64.mul
  local.get $4
  local.get $7
  f64.const 6.613756321437934e-05
  f64.mul
  f64.const -2.7777777777015593e-03
  f64.add
  local.get $4
  local.get $7
  f64.const 4.1381367970572385e-08
  f64.mul
  f64.const -1.6533902205465252e-06
  f64.add
  f64.mul
  f64.add
  f64.mul
  f64.add
  f64.sub
  local.tee $0
  f64.mul
  f64.const 2
  local.get $0
  f64.sub
  f64.div
  local.get $6
  f64.sub
  local.get $2
  f64.add
  f64.const 1
  f64.add
  local.tee $2
  local.set $0
  local.get $3
  local.tee $1
  i32.const 1023
  i32.gt_s
  if (result f64)
   local.get $0
   f64.const 8988465674311579538646525e283
   f64.mul
   local.set $0
   local.get $1
   i32.const 1023
   i32.sub
   local.tee $1
   i32.const 1023
   i32.gt_s
   if (result f64)
    i32.const 1023
    local.get $1
    i32.const 1023
    i32.sub
    local.tee $1
    local.get $1
    i32.const 1023
    i32.ge_s
    select
    local.set $1
    local.get $0
    f64.const 8988465674311579538646525e283
    f64.mul
   else
    local.get $0
   end
  else
   local.get $1
   i32.const -1022
   i32.lt_s
   if (result f64)
    local.get $0
    f64.const 2.004168360008973e-292
    f64.mul
    local.set $0
    local.get $1
    i32.const 969
    i32.add
    local.tee $1
    i32.const -1022
    i32.lt_s
    if (result f64)
     i32.const -1022
     local.get $1
     i32.const 969
     i32.add
     local.tee $1
     local.get $1
     i32.const -1022
     i32.le_s
     select
     local.set $1
     local.get $0
     f64.const 2.004168360008973e-292
     f64.mul
    else
     local.get $0
    end
   else
    local.get $0
   end
  end
  local.get $1
  i64.extend_i32_s
  i64.const 1023
  i64.add
  i64.const 52
  i64.shl
  f64.reinterpret_i64
  f64.mul
  local.get $2
  local.get $3
  select
 )
 (func $assembly/index/setVoiceGender (param $0 i32)
  local.get $0
  global.set $assembly/index/voiceGender
 )
 (func $assembly/index/setRmsThreshold (param $0 f32)
  local.get $0
  global.set $assembly/index/rmsThreshold
 )
 (func $assembly/index/setHoldFrames (param $0 i32)
  local.get $0
  global.set $assembly/index/holdFrames
 )
 (func $assembly/index/runFft
  (local $0 i32)
  (local $1 i32)
  (local $2 i32)
  (local $3 f32)
  (local $4 i32)
  (local $5 f32)
  (local $6 i32)
  (local $7 i32)
  (local $8 f32)
  (local $9 f32)
  (local $10 f32)
  (local $11 i32)
  (local $12 f32)
  (local $13 i32)
  (local $14 i32)
  (local $15 i32)
  (local $16 f32)
  loop $for-loop|0
   local.get $0
   i32.const 1024
   i32.lt_s
   if
    local.get $0
    i32.const 2
    i32.shl
    local.tee $1
    i32.const 40960
    i32.add
    local.get $1
    i32.const 58100
    i32.add
    i32.load
    i32.const 2
    i32.shl
    i32.const 36864
    i32.add
    f32.load
    f32.store
    local.get $1
    i32.const 45056
    i32.add
    f32.const 0
    f32.store
    local.get $0
    i32.const 1
    i32.add
    local.set $0
    br $for-loop|0
   end
  end
  i32.const 1
  local.set $1
  loop $for-loop|1
   local.get $1
   i32.const 10
   i32.le_s
   if
    i32.const 1
    local.get $1
    i32.shl
    local.set $6
    i32.const 512
    i32.const 1
    local.get $1
    i32.const 1
    i32.sub
    i32.shl
    local.tee $4
    i32.div_s
    local.set $7
    i32.const 0
    local.set $2
    loop $for-loop|2
     local.get $2
     i32.const 1024
     i32.lt_s
     if
      i32.const 0
      local.set $0
      loop $for-loop|3
       local.get $0
       local.get $4
       i32.lt_s
       if
        local.get $0
        local.get $2
        i32.add
        local.tee $11
        i32.const 2
        i32.shl
        local.tee $13
        i32.const 40960
        i32.add
        local.tee $14
        f32.load
        local.set $3
        local.get $13
        i32.const 45056
        i32.add
        local.tee $13
        f32.load
        local.set $5
        local.get $14
        local.get $3
        local.get $4
        local.get $11
        i32.add
        i32.const 2
        i32.shl
        local.tee $14
        i32.const 40960
        i32.add
        local.tee $11
        f32.load
        local.tee $12
        local.get $0
        local.get $7
        i32.mul
        i32.const 2
        i32.shl
        local.tee $15
        i32.const 62200
        i32.add
        f32.load
        local.tee $16
        f32.mul
        local.get $14
        i32.const 45056
        i32.add
        local.tee $14
        f32.load
        local.tee $8
        local.get $15
        i32.const 64248
        i32.add
        f32.load
        local.tee $9
        f32.mul
        f32.sub
        local.tee $10
        f32.add
        f32.store
        local.get $13
        local.get $5
        local.get $12
        local.get $9
        f32.mul
        local.get $8
        local.get $16
        f32.mul
        f32.add
        local.tee $8
        f32.add
        f32.store
        local.get $11
        local.get $3
        local.get $10
        f32.sub
        f32.store
        local.get $14
        local.get $5
        local.get $8
        f32.sub
        f32.store
        local.get $0
        i32.const 1
        i32.add
        local.set $0
        br $for-loop|3
       end
      end
      local.get $2
      local.get $6
      i32.add
      local.set $2
      br $for-loop|2
     end
    end
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|1
   end
  end
 )
 (func $assembly/index/resetState
  i32.const -1
  global.set $assembly/index/currentPhoneme
  i32.const 0
  global.set $assembly/index/isVoicing
  i32.const 0
  global.set $assembly/index/silenceHoldCounter
  f32.const 0
  global.set $assembly/index/smoothedRms
 )
 (func $assembly/index/processFrame
  (local $0 f32)
  (local $1 i32)
  (local $2 f32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 f32)
  (local $8 i32)
  (local $9 f32)
  (local $10 f32)
  (local $11 f32)
  (local $12 f32)
  global.get $assembly/index/initialized
  i32.eqz
  if
   f32.const 44100
   call $assembly/index/init
  end
  loop $for-loop|0
   local.get $1
   i32.const 1024
   i32.lt_s
   if
    local.get $2
    local.get $1
    i32.const 2
    i32.shl
    local.tee $3
    i32.const 32768
    i32.add
    f32.load
    local.tee $0
    local.get $0
    f32.mul
    f32.add
    local.set $2
    local.get $3
    i32.const 36864
    i32.add
    local.get $0
    local.get $3
    i32.const 54000
    i32.add
    f32.load
    f32.mul
    f32.store
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|0
   end
  end
  global.get $assembly/index/smoothedRms
  f32.const 0.6000000238418579
  f32.mul
  local.get $2
  f32.const 0.0009765625
  f32.mul
  f64.promote_f32
  f64.sqrt
  f32.demote_f64
  local.tee $0
  f32.const 0.4000000059604645
  f32.mul
  f32.add
  global.set $assembly/index/smoothedRms
  local.get $0
  global.get $assembly/index/smoothedRms
  local.get $0
  global.get $assembly/index/smoothedRms
  f32.gt
  select
  local.set $7
  global.get $assembly/index/isVoicing
  if
   local.get $7
   f32.const 0.003000000026077032
   f32.lt
   if
    global.get $assembly/index/silenceHoldCounter
    i32.const 0
    i32.gt_s
    if
     global.get $assembly/index/silenceHoldCounter
     i32.const 1
     i32.sub
     global.set $assembly/index/silenceHoldCounter
    else
     i32.const 0
     global.set $assembly/index/isVoicing
    end
   else
    global.get $assembly/index/holdFrames
    global.set $assembly/index/silenceHoldCounter
   end
  else
   local.get $7
   global.get $assembly/index/rmsThreshold
   f32.ge
   if
    i32.const 1
    global.set $assembly/index/isVoicing
    global.get $assembly/index/holdFrames
    global.set $assembly/index/silenceHoldCounter
   end
  end
  global.get $assembly/index/isVoicing
  i32.eqz
  if
   i32.const -1
   global.set $assembly/index/currentPhoneme
   i32.const 53424
   i32.const -1
   i32.store
   i32.const 53428
   local.get $7
   f32.store
   i32.const 53432
   f32.const 0
   f32.store
   i32.const 53436
   f32.const 0
   f32.store
   i32.const 0
   local.set $1
   loop $for-loop|1
    local.get $1
    i32.const 5
    i32.lt_s
    if
     local.get $1
     i32.const 2
     i32.shl
     i32.const 53404
     i32.add
     f32.const 99
     f32.store
     local.get $1
     i32.const 1
     i32.add
     local.set $1
     br $for-loop|1
    end
   end
   return
  end
  call $assembly/index/runFft
  i32.const 0
  local.set $1
  loop $for-loop|2
   local.get $1
   i32.const 512
   i32.lt_s
   if
    local.get $1
    i32.const 2
    i32.shl
    local.tee $3
    i32.const 40960
    i32.add
    f32.load
    local.set $0
    local.get $3
    i32.const 49152
    i32.add
    local.get $0
    local.get $0
    f32.mul
    local.get $3
    i32.const 45056
    i32.add
    f32.load
    local.tee $0
    local.get $0
    f32.mul
    f32.add
    f32.store
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|2
   end
  end
  loop $for-loop|3
   local.get $6
   i32.const 26
   i32.lt_s
   if
    local.get $6
    i32.const 2
    i32.shl
    local.tee $1
    i32.const 66504
    i32.add
    i32.load
    local.set $5
    f32.const 0
    local.set $2
    local.get $1
    i32.const 66400
    i32.add
    i32.load
    local.tee $4
    local.get $1
    i32.const 66296
    i32.add
    i32.load
    local.tee $1
    i32.gt_s
    if
     local.get $4
     local.get $1
     i32.sub
     f32.convert_i32_s
     local.set $0
     local.get $1
     local.set $3
     loop $for-loop|4
      local.get $3
      i32.const 512
      i32.lt_s
      local.get $3
      local.get $4
      i32.lt_s
      i32.and
      if
       local.get $2
       local.get $3
       local.get $1
       i32.sub
       f32.convert_i32_s
       local.get $0
       f32.div
       local.get $3
       i32.const 2
       i32.shl
       i32.const 49152
       i32.add
       f32.load
       f32.mul
       f32.add
       local.set $2
       local.get $3
       i32.const 1
       i32.add
       local.set $3
       br $for-loop|4
      end
     end
    end
    local.get $4
    local.get $5
    i32.lt_s
    if
     local.get $5
     local.get $4
     i32.sub
     f32.convert_i32_s
     local.set $0
     loop $for-loop|5
      local.get $4
      i32.const 512
      i32.lt_s
      local.get $4
      local.get $5
      i32.lt_s
      i32.and
      if
       local.get $2
       local.get $5
       local.get $4
       i32.sub
       f32.convert_i32_s
       local.get $0
       f32.div
       local.get $4
       i32.const 2
       i32.shl
       i32.const 49152
       i32.add
       f32.load
       f32.mul
       f32.add
       local.set $2
       local.get $4
       i32.const 1
       i32.add
       local.set $4
       br $for-loop|5
      end
     end
    end
    local.get $6
    i32.const 2
    i32.shl
    i32.const 53248
    i32.add
    local.get $2
    f32.const 1
    f32.add
    f64.promote_f32
    call $~lib/math/NativeMath.log
    f32.demote_f64
    f32.store
    local.get $6
    i32.const 1
    i32.add
    local.set $6
    br $for-loop|3
   end
  end
  i32.const 0
  local.set $3
  loop $for-loop|6
   local.get $3
   i32.const 13
   i32.lt_s
   if
    f32.const 0
    local.set $0
    local.get $3
    i32.const 26
    i32.mul
    local.set $1
    i32.const 0
    local.set $4
    loop $for-loop|7
     local.get $4
     i32.const 26
     i32.lt_s
     if
      local.get $0
      local.get $4
      i32.const 2
      i32.shl
      i32.const 53248
      i32.add
      f32.load
      local.get $1
      local.get $4
      i32.add
      i32.const 2
      i32.shl
      i32.const 66608
      i32.add
      f32.load
      f32.mul
      f32.add
      local.set $0
      local.get $4
      i32.const 1
      i32.add
      local.set $4
      br $for-loop|7
     end
    end
    local.get $3
    i32.const 2
    i32.shl
    i32.const 53352
    i32.add
    local.get $0
    local.get $0
    f32.add
    f32.store
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|6
   end
  end
  i32.const -1
  local.set $5
  f32.const 999999
  local.set $0
  i32.const 1328
  i32.const 1056
  global.get $assembly/index/voiceGender
  select
  local.set $3
  i32.const 0
  local.set $1
  loop $for-loop|8
   local.get $1
   i32.const 5
   i32.lt_s
   if
    f32.const 0
    local.set $2
    local.get $1
    i32.const 12
    i32.mul
    local.set $4
    i32.const 0
    local.set $6
    loop $for-loop|9
     local.get $6
     i32.const 12
     i32.lt_s
     if
      local.get $2
      local.get $6
      i32.const 2
      i32.shl
      i32.const 53356
      i32.add
      f32.load
      local.get $3
      local.get $4
      local.get $6
      i32.add
      call $~lib/staticarray/StaticArray<f32>#__get
      f32.sub
      local.tee $2
      local.get $2
      f32.mul
      f32.add
      local.set $2
      local.get $6
      i32.const 1
      i32.add
      local.set $6
      br $for-loop|9
     end
    end
    local.get $1
    i32.const 2
    i32.shl
    i32.const 53404
    i32.add
    local.get $2
    f64.promote_f32
    f64.sqrt
    f32.demote_f64
    local.tee $2
    f32.const 0.8199999928474426
    f32.mul
    local.get $2
    global.get $assembly/index/currentPhoneme
    local.get $1
    i32.eq
    select
    local.tee $2
    f32.const 50
    f32.div
    f32.const 100
    f32.mul
    f64.promote_f32
    call $~lib/math/NativeMath.round
    f32.demote_f64
    f32.const 100
    f32.div
    f32.store
    local.get $0
    local.get $2
    f32.gt
    if
     local.get $1
     local.set $5
     local.get $2
     local.set $0
    end
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|8
   end
  end
  local.get $5
  global.set $assembly/index/currentPhoneme
  f64.const 360
  global.get $assembly/index/sampleRate
  f32.const 0.0009765625
  f32.mul
  local.tee $10
  f64.promote_f32
  f64.const 2
  f64.mul
  f64.div
  call $~lib/math/NativeMath.round
  f64.const 3
  f64.max
  i32.trunc_sat_f64_s
  local.set $1
  loop $for-loop|10
   local.get $8
   i32.const 512
   i32.lt_s
   if
    f32.const 0
    local.set $0
    i32.const 0
    local.set $6
    i32.const 0
    local.get $1
    i32.sub
    local.set $3
    loop $for-loop|11
     local.get $1
     local.get $3
     i32.ge_s
     if
      local.get $3
      local.get $8
      i32.add
      local.tee $4
      i32.const 512
      i32.lt_s
      local.get $4
      i32.const 0
      i32.ge_s
      i32.and
      if
       local.get $6
       i32.const 1
       i32.add
       local.set $6
       local.get $0
       local.get $4
       i32.const 2
       i32.shl
       i32.const 49152
       i32.add
       f32.load
       f32.add
       local.set $0
      end
      local.get $3
      i32.const 1
      i32.add
      local.set $3
      br $for-loop|11
     end
    end
    local.get $8
    i32.const 2
    i32.shl
    i32.const 51200
    i32.add
    local.get $0
    local.get $6
    f32.convert_i32_s
    f32.const 1
    local.get $6
    i32.const 0
    i32.gt_s
    select
    f32.div
    f32.store
    local.get $8
    i32.const 1
    i32.add
    local.set $8
    br $for-loop|10
   end
  end
  i32.const 1712
  i32.const 1600
  global.get $assembly/index/voiceGender
  select
  local.tee $1
  local.get $5
  i32.const 0
  local.get $5
  i32.const 5
  i32.lt_s
  local.get $5
  i32.const 0
  i32.ge_s
  i32.and
  select
  i32.const 2
  i32.shl
  local.tee $3
  call $~lib/staticarray/StaticArray<f32>#__get
  local.get $1
  local.get $3
  i32.const 1
  i32.add
  call $~lib/staticarray/StaticArray<f32>#__get
  local.get $1
  local.get $3
  i32.const 2
  i32.add
  call $~lib/staticarray/StaticArray<f32>#__get
  local.set $0
  local.get $1
  local.get $3
  i32.const 3
  i32.add
  call $~lib/staticarray/StaticArray<f32>#__get
  local.set $9
  f32.const -1
  local.set $2
  local.get $10
  f32.div
  f64.promote_f32
  call $~lib/math/NativeMath.round
  i32.trunc_sat_f64_s
  local.set $3
  local.get $10
  f32.div
  f64.promote_f32
  call $~lib/math/NativeMath.round
  i32.trunc_sat_f64_s
  local.tee $4
  local.set $1
  loop $for-loop|12
   local.get $1
   i32.const 512
   i32.lt_s
   local.get $1
   local.get $3
   i32.le_s
   i32.and
   if
    local.get $1
    i32.const 2
    i32.shl
    i32.const 51200
    i32.add
    f32.load
    local.tee $11
    local.get $2
    f32.gt
    if
     local.get $1
     local.set $4
     local.get $11
     local.set $2
    end
    local.get $1
    i32.const 1
    i32.add
    local.set $1
    br $for-loop|12
   end
  end
  f32.const -1
  local.set $2
  local.get $9
  local.get $10
  f32.div
  f64.promote_f32
  call $~lib/math/NativeMath.round
  i32.trunc_sat_f64_s
  local.set $6
  local.get $0
  local.get $10
  f32.div
  f64.promote_f32
  call $~lib/math/NativeMath.round
  i32.trunc_sat_f64_s
  local.tee $1
  local.set $3
  loop $for-loop|13
   local.get $3
   i32.const 512
   i32.lt_s
   local.get $3
   local.get $6
   i32.le_s
   i32.and
   if
    local.get $3
    i32.const 2
    i32.shl
    i32.const 51200
    i32.add
    f32.load
    local.tee $0
    local.get $2
    f32.gt
    if
     local.get $0
     local.set $2
     local.get $3
     local.set $1
    end
    local.get $3
    i32.const 1
    i32.add
    local.set $3
    br $for-loop|13
   end
  end
  i32.const 53424
  local.get $5
  i32.store
  i32.const 53428
  local.get $7
  f32.store
  i32.const 53432
  local.get $4
  f32.convert_i32_s
  local.get $10
  f32.mul
  f64.promote_f32
  call $~lib/math/NativeMath.round
  f32.demote_f64
  f32.store
  i32.const 53436
  local.get $1
  f32.convert_i32_s
  local.get $10
  f32.mul
  f64.promote_f32
  call $~lib/math/NativeMath.round
  f32.demote_f64
  f32.store
 )
)
