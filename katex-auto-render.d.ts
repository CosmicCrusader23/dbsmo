declare module "katex/dist/contrib/auto-render" {
  type Delimiter = {
    left: string;
    right: string;
    display: boolean;
  };

  type AutoRenderOptions = {
    delimiters?: Delimiter[];
    throwOnError?: boolean;
    strict?: boolean | string | ((errorCode: string, errorMsg: string, token: string) => boolean | string);
  };

  export default function renderMathInElement(
    element: HTMLElement,
    options?: AutoRenderOptions,
  ): void;
}
