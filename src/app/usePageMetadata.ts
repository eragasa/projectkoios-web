import { useEffect } from "react";

const SITE_NAME = "Project Koios";

export function usePageMetadata(title: string, description: string) {
  useEffect(() => {
    document.title = title === SITE_NAME ? SITE_NAME : `${title} · ${SITE_NAME}`;
    let descriptionElement = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    if (!descriptionElement) {
      descriptionElement = document.createElement("meta");
      descriptionElement.name = "description";
      document.head.append(descriptionElement);
    }
    descriptionElement.content = description;
  }, [description, title]);
}
