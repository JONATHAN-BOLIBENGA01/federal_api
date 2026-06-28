export class CreateArticleDto {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  image?: string;
  author: string;
  status?: string;
}

export class UpdateArticleDto {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string;
  image?: string;
  author?: string;
  status?: string;
}
