# Reference outfit revision

This revision replaces the first approximation with a fitted knit bodice, reconstructed puff sleeves, folded cuffs, double-seamed collar leaves, flat grosgrain ribbon, a wider irregularly folded skirt, slim rectangular belt buckle, detailed angled satchel, and stitched low-heel loafers.

All visible outfit materials use the VRM addon's native MToon 1.0 schema. The bodice, both sleeves, and skirt have baked albedo PNGs. Cloth appearance does not depend on the earlier custom Shader-to-RGB material or vertex-color shading. Small accessories use native MToon base colors and geometry for their detail. Textures are packed into the Blender file.

The fabric grain source was generated with the built-in image generation tool from the user's outfit illustration. The resulting source is `fabric_atlas.png`. The production prompt requested an equal-half atlas of warm ivory fine-gauge knit and muted dusty rose woven fabric, flat lighting, subtle textile grain, without clothing silhouettes, text, seams, or large folds. A follow-up image generation request for illustrated skirt fold shading was rejected by the image-generation usage limit. Final fold values were instead authored in Blender and baked, together with the generated fabric grain, into `Draped_Flare_Skirt_Albedo.png`. The bake excludes scene lighting, so the final MToon material remains responsive to VRM lighting.

## Rig and validation

The original character rig, facial expressions, and original VRM metadata remain in place. The skirt retains 12 spring chains, each with four deforming segments and an endpoint, and four leg capsule colliders. The bones were refitted to the wider skirt. The presentation pose has lowered arms and relaxed hands; it is not the bind pose.

`motion_validation.json` records checks on the revised mesh. Rest, simulated standing, left/right 20-degree leg steps, and a walking sample with opposing leg rotations plus 25-degree knee flexion had zero skirt/body surface intersections in the covered leg region (Z 0.35–1.025 m). The simulations used 75 steps per pose. All skirt vertex weights sum to one, and all referenced deform bones exist. These sampled poses do not establish collision-free behavior for every animation, deep crouch, or kick.

The skirt's subdivision was baked into its final mesh and each vertex limited to four normalized influences, matching the VRM export. The motion checks were repeated on that final mesh and still reported zero sampled intersections. The exported VRM contains 19 native MToon outfit materials, four baked garment albedo textures, and all 12 skirt spring chains. The export structure has been checked; a separate VRM application's rendering has not been tested.

The previous outfit remains hidden for recovery. `before_detail_revision.blend` is the pre-revision backup. Archived meshes and the comparison studio are excluded from the VRM export.
