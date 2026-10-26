-- Mixed is offered only on services, so it reads as what it is: the mixed team of a 5th Sunday.
UPDATE "Ministry" SET "label" = 'Mixed team (5th Sunday)' WHERE "code" = 'MIXED' AND "label" = 'Mixed';
