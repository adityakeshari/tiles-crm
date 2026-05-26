DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'product_size'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'tile_size'
  ) THEN
    UPDATE products
    SET product_size = tile_size
    WHERE COALESCE(TRIM(product_size), '') = ''
      AND COALESCE(TRIM(tile_size), '') <> '';

    UPDATE products
    SET tile_size = product_size
    WHERE COALESCE(TRIM(tile_size), '') = ''
      AND COALESCE(TRIM(product_size), '') <> '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'company_name'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'company'
  ) THEN
    UPDATE products
    SET company_name = company
    WHERE COALESCE(TRIM(company_name), '') = ''
      AND COALESCE(TRIM(company), '') <> '';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'design_code'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'code'
  ) THEN
    UPDATE products
    SET design_code = code
    WHERE COALESCE(TRIM(design_code), '') = ''
      AND COALESCE(TRIM(code), '') <> '';
  END IF;
END $$;
