// Metro bundles `.svg` files as image assets (`resolver.assetExts`): an import
// is the asset's id, which expo-image renders.
declare module "*.svg" {
  const asset: number;
  export default asset;
}
